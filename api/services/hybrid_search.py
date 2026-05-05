"""
Hybrid Search Service — FutureAssist AI v3.0 Phase 2

pgvector コサイン検索 + PostgreSQL 全文検索 (FTS) を
RRF (Reciprocal Rank Fusion) で統合し、
公的サイト (public_sites) を意味的に検索する。

pgvector が使えない場合は FTS のみにフォールバック。
OPENAI_API_KEY が未設定の場合はエンベッドをスキップし FTS のみ動作。
"""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── 定数 ────────────────────────────────────────────────────────────────────
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
CONFIDENCE_THRESHOLD = 0.50       # これ未満は CriticAgent が保留判定
RRF_K = 60                        # RRF の平滑化定数（標準値）
FTS_LIMIT_MULTIPLIER = 3          # RRF 前の候補数を limit × この値だけ取得


class HybridSearchService:
    """
    公的サイト検索サービス。

    1. embed_text()         — クエリをベクトル化
    2. vector_search()      — pgvector コサイン検索（pgvector 未対応時はスキップ）
    3. fts_search()         — PostgreSQL FTS (simple 辞書)
    4. _rrf_merge()         — RRF でランキング統合
    5. search()             — フルパイプライン（呼び出し元はこれだけ使えば OK）

    embed_and_store_message() はチャット履歴を message_embeddings に保存する
    補助メソッド（ConciergeAgent から呼ばれる）。
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._pgvector_available: Optional[bool] = None  # 遅延確認

    # ─── pgvector 可否チェック ────────────────────────────────────────────────

    async def _check_pgvector(self) -> bool:
        if self._pgvector_available is not None:
            return self._pgvector_available
        try:
            await self.db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
            result = await self.db.execute(
                text("SELECT column_name FROM information_schema.columns "
                     "WHERE table_name='public_sites' AND column_name='embedding'")
            )
            has_col = result.fetchone() is not None
            self._pgvector_available = has_col
        except Exception:
            self._pgvector_available = False
        return self._pgvector_available

    # ─── テキストのエンベッド ──────────────────────────────────────────────────

    async def embed_text(self, text_input: str) -> Optional[list[float]]:
        """OpenAI text-embedding-3-small でテキストをベクトル化する。"""
        if not settings.openai_api_key:
            return None
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text_input[:8000],  # トークン上限対策
            )
            return response.data[0].embedding
        except Exception as e:
            logger.warning(f"embed_text failed: {e}")
            return None

    # ─── ベクトル検索 ──────────────────────────────────────────────────────────

    async def vector_search(
        self,
        embedding: list[float],
        topic: str,
        worry_subtarget: Optional[str],
        limit: int,
    ) -> list[dict]:
        """
        public_sites.embedding に対してコサイン距離検索を行う。
        結果には cosine_distance (0-2) と confidence (0-100) を含む。
        """
        try:
            vec_str = "[" + ",".join(str(v) for v in embedding) + "]"

            where_extra = ""
            params: dict = {"topic": topic, "vec": vec_str, "limit": limit * FTS_LIMIT_MULTIPLIER}
            if worry_subtarget:
                where_extra = "AND (worry_target = :wt OR worry_target IS NULL)"
                params["wt"] = worry_subtarget

            sql = f"""
                SELECT
                    id,
                    title,
                    url,
                    description,
                    category,
                    worry_target,
                    guidance_reason,
                    skip_info,
                    (embedding <=> :vec::vector)  AS cosine_distance
                FROM public_sites
                WHERE topic = :topic
                  AND is_active = TRUE
                  AND embedding IS NOT NULL
                  {where_extra}
                ORDER BY cosine_distance ASC
                LIMIT :limit
            """
            result = await self.db.execute(text(sql), params)
            rows = result.fetchall()

            return [
                {
                    "id": r[0],
                    "title": r[1],
                    "url": r[2],
                    "description": r[3],
                    "category": r[4],
                    "worry_target": r[5],
                    "guidance_reason": r[6] or r[3],
                    "skip_info": r[7],
                    "cosine_distance": float(r[8]),
                    "confidence": round((1.0 - float(r[8]) / 2.0) * 100, 2),  # 0-100%
                    "_rank_source": "vector",
                }
                for r in rows
            ]
        except Exception as e:
            logger.warning(f"vector_search failed: {e}")
            return []

    # ─── 全文検索 (FTS) ────────────────────────────────────────────────────────

    async def fts_search(
        self,
        query_text: str,
        topic: str,
        worry_subtarget: Optional[str],
        limit: int,
    ) -> list[dict]:
        """
        PostgreSQL FTS (simple 辞書) で title + description + guidance_reason を検索。
        """
        try:
            where_extra = ""
            params: dict = {
                "topic": topic,
                "query": query_text,
                "limit": limit * FTS_LIMIT_MULTIPLIER,
            }
            if worry_subtarget:
                where_extra = "AND (worry_target = :wt OR worry_target IS NULL)"
                params["wt"] = worry_subtarget

            # plainto_tsquery は日本語でもトークン分割できる（simple 辞書）
            sql = f"""
                SELECT
                    id,
                    title,
                    url,
                    description,
                    category,
                    worry_target,
                    guidance_reason,
                    skip_info,
                    ts_rank(
                        to_tsvector('simple',
                            COALESCE(title,'') || ' ' ||
                            COALESCE(description,'') || ' ' ||
                            COALESCE(guidance_reason,'')),
                        plainto_tsquery('simple', :query)
                    ) AS fts_rank
                FROM public_sites
                WHERE topic = :topic
                  AND is_active = TRUE
                  {where_extra}
                ORDER BY fts_rank DESC
                LIMIT :limit
            """
            result = await self.db.execute(text(sql), params)
            rows = result.fetchall()

            return [
                {
                    "id": r[0],
                    "title": r[1],
                    "url": r[2],
                    "description": r[3],
                    "category": r[4],
                    "worry_target": r[5],
                    "guidance_reason": r[6] or r[3],
                    "skip_info": r[7],
                    "fts_rank": float(r[8]),
                    # FTS スコアを擬似 confidence に変換（0-100%、上限 80%）
                    "confidence": min(round(float(r[8]) * 1000, 2), 80.0),
                    "_rank_source": "fts",
                }
                for r in rows
            ]
        except Exception as e:
            logger.warning(f"fts_search failed: {e}")
            return []

    # ─── RRF (Reciprocal Rank Fusion) ─────────────────────────────────────────

    def _rrf_merge(
        self,
        vector_results: list[dict],
        fts_results: list[dict],
        limit: int,
    ) -> list[dict]:
        """
        2つのランキングリストを RRF スコアで統合する。
        RRF スコア = Σ 1 / (k + rank_i) で各リストの順位を合算。
        """
        scores: dict[int, float] = {}
        meta: dict[int, dict] = {}

        for rank, item in enumerate(vector_results, start=1):
            site_id = item["id"]
            scores[site_id] = scores.get(site_id, 0.0) + 1.0 / (RRF_K + rank)
            meta[site_id] = item

        for rank, item in enumerate(fts_results, start=1):
            site_id = item["id"]
            scores[site_id] = scores.get(site_id, 0.0) + 1.0 / (RRF_K + rank)
            if site_id not in meta:
                meta[site_id] = item

        # RRF スコア降順でソート
        sorted_ids = sorted(scores.keys(), key=lambda sid: scores[sid], reverse=True)

        merged = []
        for site_id in sorted_ids[:limit]:
            item = dict(meta[site_id])
            item["rrf_score"] = round(scores[site_id], 6)
            # 最終 confidence: vector があればコサイン信頼度、なければ FTS 擬似値
            if "cosine_distance" in item:
                item["confidence"] = round((1.0 - item["cosine_distance"] / 2.0) * 100, 2)
            merged.append(item)

        return merged

    # ─── フルパイプライン ──────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        topic: str,
        worry_subtarget: Optional[str] = None,
        limit: int = 3,
    ) -> list[dict]:
        """
        ハイブリッド検索のエントリーポイント。

        Returns:
            list of site dicts, each with:
              - title, url, description, guidance_reason, skip_info
              - confidence (0-100): 信頼度スコア
            空リスト or confidence が全て CONFIDENCE_THRESHOLD*100 未満の場合、
            呼び出し元（ConciergeAgent）が「情報が見つかりません」を返す。
        """
        pgvector_ok = await self._check_pgvector()
        embedding: Optional[list[float]] = None

        if pgvector_ok:
            embedding = await self.embed_text(query)

        # 並行検索
        vec_results = []
        if embedding:
            vec_results = await self.vector_search(embedding, topic, worry_subtarget, limit)

        fts_results = await self.fts_search(query, topic, worry_subtarget, limit)

        # 結果統合
        if vec_results and fts_results:
            results = self._rrf_merge(vec_results, fts_results, limit)
        elif vec_results:
            results = vec_results[:limit]
        elif fts_results:
            results = fts_results[:limit]
        else:
            logger.info(f"hybrid_search: no results for topic={topic} query={query!r}")
            return []

        logger.info(
            f"hybrid_search: topic={topic}, query={query!r}, "
            f"results={len(results)}, top_confidence={results[0].get('confidence',0):.1f}%"
            if results else
            f"hybrid_search: topic={topic}, no results"
        )
        return results

    # ─── メッセージ埋め込み保存 ────────────────────────────────────────────────

    async def embed_and_store_message(
        self,
        message_id: int,
        session_id: UUID,
        tenant_id: Optional[UUID],
        content: str,
    ) -> bool:
        """
        チャットメッセージを text-embedding-3-small でベクトル化し
        message_embeddings テーブルに保存する。

        pgvector が使えない場合や OPENAI_API_KEY 未設定の場合は何もしない。
        """
        pgvector_ok = await self._check_pgvector()
        if not pgvector_ok:
            return False

        embedding = await self.embed_text(content)
        if not embedding:
            return False

        try:
            vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
            await self.db.execute(
                text("""
                    INSERT INTO message_embeddings
                        (message_id, tenant_id, embedding, content_text)
                    VALUES
                        (:msg_id, :tenant_id, :vec::vector, :content)
                    ON CONFLICT (message_id) DO NOTHING
                """),
                {
                    "msg_id": message_id,
                    "tenant_id": str(tenant_id) if tenant_id else None,
                    "vec": vec_str,
                    "content": content[:2000],
                },
            )
            return True
        except Exception as e:
            logger.warning(f"embed_and_store_message failed (msg_id={message_id}): {e}")
            return False


# ─── 起動時シード処理（main.py lifespan から呼ばれる） ──────────────────────────

async def seed_public_site_embeddings(db: AsyncSession, max_sites: int = 50) -> int:
    """
    public_sites の embedding が NULL の行を最大 max_sites 件だけ埋め込んでDBに保存する。
    pgvector 未対応 or OPENAI_API_KEY 未設定の場合は 0 を返す。

    Returns:
        埋め込んだサイト件数
    """
    if not settings.openai_api_key:
        logger.info("seed_public_site_embeddings: OPENAI_API_KEY not set, skipping")
        return 0

    # pgvector + embedding カラム存在確認
    try:
        result = await db.execute(
            text("SELECT column_name FROM information_schema.columns "
                 "WHERE table_name='public_sites' AND column_name='embedding'")
        )
        if not result.fetchone():
            logger.info("seed_public_site_embeddings: embedding column not found, skipping")
            return 0
    except Exception:
        return 0

    # embedding が NULL のサイトを取得
    result = await db.execute(
        text(
            "SELECT id, title, description, guidance_reason "
            "FROM public_sites WHERE embedding IS NULL AND is_active = TRUE "
            "LIMIT :limit"
        ),
        {"limit": max_sites},
    )
    rows = result.fetchall()

    if not rows:
        logger.info("seed_public_site_embeddings: all sites already embedded")
        return 0

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    count = 0
    for row in rows:
        site_id, title, description, guidance_reason = row
        text_to_embed = f"{title}。{description or ''}。{guidance_reason or ''}"
        try:
            response = await client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=text_to_embed[:4000],
            )
            embedding = response.data[0].embedding
            vec_str = "[" + ",".join(str(v) for v in embedding) + "]"
            await db.execute(
                text("UPDATE public_sites SET embedding = :vec::vector WHERE id = :id"),
                {"vec": vec_str, "id": site_id},
            )
            count += 1
        except Exception as e:
            logger.warning(f"seed_public_site_embeddings: site_id={site_id} failed: {e}")
            continue

    await db.commit()
    logger.info(f"seed_public_site_embeddings: embedded {count} sites")
    return count
