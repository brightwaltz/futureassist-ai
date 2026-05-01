"""
Agent Graph — FutureAssist AI v3.0 Phase 2

Pure Python ステートマシンによる 3エージェント構成。
LangGraph 等の外部ライブラリは使用しない。

アーキテクチャ:
  CoachingAgent   — 既存 8ステート対話エンジンをラップ
  ConciergeAgent  — HybridSearchService で公的サイト案内
  CriticAgent     — 信頼度チェック・回答保留判定

エントリーポイント: AgentGraph.run(ctx)
"""
from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from api.services.agent_state import AgentContext, AgentResult, AgentType
from api.services.coaching_service import CoachingService, DIALOGUE_STATES
from api.services.hybrid_search import HybridSearchService
from api.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# CriticAgent の信頼度閾値（この値未満なら CoachingAgent にフォールバック）
CONFIDENCE_THRESHOLD = 0.50

# ConciergeAgent を試みるダイアログステート
CONCIERGE_STATES = {"action_bridging", "worry_level_check", "information_organizing"}


# ─────────────────────────────────────────────────────────────────────────────
# CoachingAgent
# ─────────────────────────────────────────────────────────────────────────────

class CoachingAgent:
    """
    既存 CoachingService.process_message() をエージェントインターフェースでラップする。
    8ステートの対話エンジンをそのまま維持。
    """

    def __init__(self, db: AsyncSession):
        self._service = CoachingService(db)

    async def process(self, ctx: AgentContext) -> AgentResult:
        result = await self._service.process_message(
            session_id=ctx.session_id,
            user_input=ctx.user_input,
            ai_client=ctx.ai_client,
        )

        # process_message は state 更新済みのセッションを DB に flush しているが
        # next_state は返さないので、セッションから取得する
        session = await self._service.get_or_create_session(ctx.session_id)
        next_state = session.latest_state if session else ctx.dialogue_state

        return AgentResult(
            reply=result["assistant_reply"],
            suggested_links=result.get("suggested_links", []),
            confidence=1.0,   # CoachingAgent は常に確定回答（信頼度 100%）
            next_state=next_state,
            emotion_label=result.get("emotion_label"),
            emotion_score=result.get("emotion_score"),
            conversation_tags=result.get("conversation_tags", {}),
            routed_to=AgentType.COACHING,
        )


# ─────────────────────────────────────────────────────────────────────────────
# ConciergeAgent
# ─────────────────────────────────────────────────────────────────────────────

class ConciergeAgent:
    """
    HybridSearchService を用いて公的サイトを意味検索し、
    AI を使って案内文を生成する。
    """

    def __init__(self, db: AsyncSession):
        self._search = HybridSearchService(db)
        self._coaching = CoachingService(db)  # AI 呼び出しと emotion 検出を借用

    async def process(self, ctx: AgentContext) -> AgentResult:
        state = ctx.dialogue_state
        worry_subtarget = state.get("worry_subtarget")

        # ハイブリッド検索
        sites = await self._search.search(
            query=ctx.user_input,
            topic=ctx.topic,
            worry_subtarget=worry_subtarget,
            limit=3,
        )

        top_confidence = sites[0].get("confidence", 0) / 100.0 if sites else 0.0

        # 案内文を生成
        reply = await self._build_reply(ctx, sites, top_confidence)

        # 感情検出（CoachingService の既存メソッドを流用）
        emotion_label, emotion_score = self._coaching._detect_emotion(ctx.user_input)

        # 状態遷移（ConciergeAgent は action_bridging → life_stability へ進める）
        new_state = self._coaching.advance_state(state)
        new_state["concierge_searched"] = True

        return AgentResult(
            reply=reply,
            suggested_links=[
                {"title": s["title"], "url": s["url"]}
                for s in sites
            ],
            confidence=top_confidence,
            next_state=new_state,
            emotion_label=emotion_label,
            emotion_score=emotion_score,
            conversation_tags=self._coaching.generate_conversation_tags(
                ctx.topic, state, ctx.user_input
            ),
            routed_to=AgentType.CONCIERGE,
        )

    async def _build_reply(
        self,
        ctx: AgentContext,
        sites: list[dict],
        confidence: float,
    ) -> str:
        """公的サイト案内文を AI で生成する。AI 不在時はテンプレートを使用。"""
        if not sites:
            return (
                "申し訳ございません、現在その内容に合致する公的情報が見つかりませんでした。"
                "お近くの相談窓口や市区町村の窓口にお問い合わせいただくことをお勧めします。"
            )

        if not ctx.ai_client:
            return self._template_reply(sites)

        # AI プロンプト組み立て
        sites_text = "\n".join(
            f"- [{s['title']}]({s['url']}): {s.get('guidance_reason', s['description'])}"
            for s in sites[:2]
        )
        system_prompt = f"""あなたは「未来アシストAI」の案内役です。
ユーザーの質問に対し、以下の公的情報源を根拠として、
簡潔かつ共感的に案内してください。

# 案内する公的情報源
{sites_text}

# ルール
- 公的情報源以外の情報は提供しない
- 法的・医療的な個別アドバイスは行わない
- 「まず〇〇を確認するとよいでしょう」のように具体的な次の一歩を提示する
- 2-3文でコンパクトにまとめる
"""
        messages = [
            {"role": "system", "content": system_prompt},
            *ctx.conversation_history[-4:],
            {"role": "user", "content": ctx.user_input},
        ]

        try:
            if settings.ai_backend == "openai":
                response = await ctx.ai_client.chat.completions.create(
                    model=settings.ai_model,
                    messages=messages,
                    temperature=0.5,
                    max_tokens=400,
                )
                return response.choices[0].message.content
            elif settings.ai_backend == "anthropic":
                system_msg = messages[0]["content"]
                chat_msgs = [m for m in messages[1:] if m["role"] != "system"]
                response = await ctx.ai_client.messages.create(
                    model=settings.ai_model,
                    system=system_msg,
                    messages=chat_msgs,
                    max_tokens=400,
                )
                return response.content[0].text
        except Exception as e:
            logger.warning(f"ConciergeAgent AI call failed: {e}")

        return self._template_reply(sites)

    def _template_reply(self, sites: list[dict]) -> str:
        top = sites[0]
        return (
            f"こちらの公的情報が参考になります。\n"
            f"**[{top['title']}]({top['url']})**\n"
            f"{top.get('guidance_reason', top['description'])}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# CriticAgent
# ─────────────────────────────────────────────────────────────────────────────

class CriticAgent:
    """
    ConciergeAgent の結果の信頼度を評価し、
    閾値未満の場合は CoachingAgent にフォールバックさせる。
    """

    @staticmethod
    def evaluate(
        ctx: AgentContext,
        concierge_result: AgentResult,
        coaching_fallback: Optional[AgentResult] = None,
    ) -> AgentResult:
        """
        信頼度が CONFIDENCE_THRESHOLD 以上なら concierge_result をそのまま返す。
        未満なら coaching_fallback（または保留メッセージ）を返す。
        """
        if concierge_result.confidence >= CONFIDENCE_THRESHOLD:
            return concierge_result

        # 信頼度不足 → CoachingAgent の結果にフォールバック
        if coaching_fallback:
            result = coaching_fallback
            result.held = False
            result.fallback_reason = (
                f"concierge_confidence={concierge_result.confidence:.2f} < {CONFIDENCE_THRESHOLD}"
            )
            return result

        # CoachingAgent の結果もない場合（稀）→ 保留メッセージ
        return AgentResult(
            reply=(
                "詳しい情報は、お近くの相談窓口や行政の窓口にお問い合わせいただくことを"
                "お勧めします。引き続き対話で整理をお手伝いします。"
            ),
            suggested_links=[],
            confidence=concierge_result.confidence,
            next_state=ctx.dialogue_state,
            emotion_label=None,
            emotion_score=None,
            conversation_tags={},
            routed_to=AgentType.CRITIC,
            held=True,
            fallback_reason=f"confidence={concierge_result.confidence:.2f} < threshold, no fallback available",
        )


# ─────────────────────────────────────────────────────────────────────────────
# AgentGraph — オーケストレーター
# ─────────────────────────────────────────────────────────────────────────────

class AgentGraph:
    """
    3エージェントを統括するオーケストレーター。

    chat.py ルーターはこのクラスの run() を呼ぶだけでよい。
    """

    def __init__(self, db: AsyncSession, ai_client=None):
        self._db = db
        self._ai_client = ai_client
        self._coaching_agent = CoachingAgent(db)
        self._concierge_agent = ConciergeAgent(db)

    async def run(self, ctx: AgentContext) -> AgentResult:
        """
        ルーティングロジック:

        1. current_step が CONCIERGE_STATES のいずれか、または
           worry_subtarget が設定済みの場合 → ConciergeAgent を試みる
        2. CriticAgent で信頼度評価
           - 信頼度 >= 50%: ConciergeAgent の結果を返す
           - 信頼度 < 50%:  CoachingAgent にフォールバック
        3. それ以外のステップ → CoachingAgent を直接呼ぶ
        """
        state = ctx.dialogue_state
        current_step = state.get("current_step", "worry_triage")
        worry_subtarget = state.get("worry_subtarget")

        use_concierge = (
            current_step in CONCIERGE_STATES
            or bool(worry_subtarget)
        )

        if not use_concierge:
            logger.debug(f"AgentGraph: routing to CoachingAgent (step={current_step})")
            return await self._coaching_agent.process(ctx)

        # ConciergeAgent を試みる
        logger.debug(f"AgentGraph: routing to ConciergeAgent (step={current_step})")
        concierge_result = await self._concierge_agent.process(ctx)

        if concierge_result.confidence >= CONFIDENCE_THRESHOLD:
            # 信頼度十分 → CriticAgent を通して確認（通過するはず）
            final = CriticAgent.evaluate(ctx, concierge_result)
            logger.info(
                f"AgentGraph: ConciergeAgent selected "
                f"(confidence={concierge_result.confidence:.2f})"
            )

            # セッション状態を DB に反映（CoachingService が行う flush と同等）
            await self._sync_session_state(ctx, final.next_state)

            # メッセージ埋め込みを非同期で保存（失敗しても継続）
            await self._store_message_embedding(ctx)

            return final

        # 信頼度不足 → CoachingAgent にフォールバック
        logger.info(
            f"AgentGraph: fallback to CoachingAgent "
            f"(concierge_confidence={concierge_result.confidence:.2f})"
        )
        coaching_result = await self._coaching_agent.process(ctx)
        return CriticAgent.evaluate(ctx, concierge_result, coaching_result)

    async def _sync_session_state(
        self, ctx: AgentContext, next_state: dict
    ) -> None:
        """
        ConciergeAgent が state 遷移した場合、セッションを DB に反映する。
        CoachingAgent は CoachingService 内部で flush 済み。
        """
        try:
            from api.models.orm import Session as ChatSession
            from sqlalchemy import select, update

            await self._db.execute(
                update(ChatSession)
                .where(ChatSession.session_id == ctx.session_id)
                .values(latest_state=next_state)
            )
            await self._db.flush()
        except Exception as e:
            logger.warning(f"_sync_session_state failed: {e}")

    async def _store_message_embedding(self, ctx: AgentContext) -> None:
        """直近ユーザーメッセージを message_embeddings に非同期で保存する（失敗許容）。"""
        try:
            from api.models.orm import Message
            from sqlalchemy import select

            # 最新のユーザーメッセージ ID を取得
            result = await self._db.execute(
                select(Message.id)
                .where(Message.session_id == ctx.session_id)
                .where(Message.role == "user")
                .order_by(Message.created_at.desc())
                .limit(1)
            )
            row = result.fetchone()
            if not row:
                return

            message_id = row[0]
            search_svc = HybridSearchService(self._db)
            await search_svc.embed_and_store_message(
                message_id=message_id,
                session_id=ctx.session_id,
                tenant_id=ctx.tenant_id,
                content=ctx.user_input,
            )
        except Exception as e:
            logger.debug(f"_store_message_embedding failed (non-fatal): {e}")
