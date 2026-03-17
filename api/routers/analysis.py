"""
AI Analysis endpoints for conversation data.
Provides summarization and clustering via OpenAI (or statistical fallback).
"""
import logging
from collections import Counter
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.config import get_settings
from api.database import get_db
from api.models.orm import Conversation, ConversationMessage
from api.routers.admin import verify_admin, _resolve_tenant

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/admin", tags=["analysis"])


# ─── Request schemas ───

class SummarizeRequest(BaseModel):
    conversation_ids: Optional[list[str]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    max_conversations: int = Field(default=50, ge=1, le=200)


class ClusterRequest(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    n_clusters: int = Field(default=5, ge=2, le=20)


# ─── Helpers ───

def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str)
    except ValueError:
        return None


async def _fetch_conversations(
    db: AsyncSession,
    tenant_id: UUID,
    conversation_ids: Optional[list[str]],
    date_from: Optional[str],
    date_to: Optional[str],
    limit: int,
) -> list:
    q = (
        select(Conversation)
        .where(Conversation.tenant_id == tenant_id)
        .options(selectinload(Conversation.messages))
    )

    if conversation_ids:
        try:
            uuids = [UUID(cid) for cid in conversation_ids]
            q = q.where(Conversation.id.in_(uuids))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid conversation ID format")

    from_dt = _parse_date(date_from)
    to_dt = _parse_date(date_to)
    if from_dt:
        q = q.where(Conversation.started_at >= from_dt)
    if to_dt:
        q = q.where(Conversation.started_at <= to_dt)

    q = q.order_by(Conversation.started_at.desc()).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


def _build_conversation_text(conv) -> str:
    """Build a readable text from conversation messages."""
    lines = []
    for msg in sorted(conv.messages, key=lambda m: m.created_at or datetime.min):
        sender = msg.sender_type or "unknown"
        lines.append(f"[{sender}]: {msg.content}")
    return "\n".join(lines)


# ─── POST /api/admin/{tenant_slug}/analysis/summarize ───

@router.post("/{tenant_slug}/analysis/summarize")
async def summarize_conversations(
    tenant_slug: str,
    body: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """Generate an AI or statistical summary of conversations."""
    tid = await _resolve_tenant(tenant_slug, db)

    conversations = await _fetch_conversations(
        db, tid, body.conversation_ids, body.date_from, body.date_to, body.max_conversations,
    )

    if not conversations:
        return {
            "summary": "対象の会話データがありません。",
            "conversation_count": 0,
            "date_range": {"from": body.date_from, "to": body.date_to},
            "top_topics": [],
            "generated_by": "statistical",
        }

    # Compute basic stats
    topic_counter = Counter(c.topic or "不明" for c in conversations)
    top_topics = [{"topic": t, "count": cnt} for t, cnt in topic_counter.most_common(10)]

    dates = [c.started_at for c in conversations if c.started_at]
    date_range = {
        "from": min(dates).isoformat() if dates else None,
        "to": max(dates).isoformat() if dates else None,
    }

    msg_counts = [len(c.messages) for c in conversations]
    avg_msg_count = round(sum(msg_counts) / len(msg_counts), 1) if msg_counts else 0

    # Try AI summary
    if settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)

            conv_texts = []
            for conv in conversations[:20]:  # Limit to 20 for token budget
                text = _build_conversation_text(conv)
                if text:
                    topic_label = conv.topic or "不明"
                    conv_texts.append(f"【トピック: {topic_label}】\n{text}")

            prompt = (
                "以下は相談AIシステムの会話データです。これらの会話を分析し、"
                "主要なテーマ、ユーザーの悩みの傾向、よくある質問パターンを日本語で要約してください。\n\n"
                + "\n\n---\n\n".join(conv_texts)
            )

            response = await client.chat.completions.create(
                model=settings.ai_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.3,
            )

            return {
                "summary": response.choices[0].message.content,
                "conversation_count": len(conversations),
                "date_range": date_range,
                "top_topics": top_topics,
                "generated_by": "ai",
            }
        except Exception as e:
            logger.warning(f"AI summarization failed, falling back to statistical: {e}")

    # Statistical fallback
    summary = (
        f"会話件数: {len(conversations)}件\n"
        f"平均メッセージ数: {avg_msg_count}\n"
        f"トップトピック: {', '.join(t['topic'] for t in top_topics[:5])}"
    )

    return {
        "summary": summary,
        "conversation_count": len(conversations),
        "date_range": date_range,
        "top_topics": top_topics,
        "generated_by": "statistical",
    }


# ─── POST /api/admin/{tenant_slug}/analysis/cluster ───

@router.post("/{tenant_slug}/analysis/cluster")
async def cluster_conversations(
    tenant_slug: str,
    body: ClusterRequest,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """Cluster conversations by theme using AI or topic grouping."""
    tid = await _resolve_tenant(tenant_slug, db)

    conversations = await _fetch_conversations(
        db, tid, None, body.date_from, body.date_to, 200,
    )

    if not conversations:
        return {
            "clusters": [],
            "total_conversations": 0,
            "generated_by": "topic_based",
        }

    # Try AI clustering
    if settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)

            conv_summaries = []
            for conv in conversations[:50]:  # Limit for token budget
                msg_preview = ""
                if conv.messages:
                    first_msgs = sorted(conv.messages, key=lambda m: m.created_at or datetime.min)[:3]
                    msg_preview = " | ".join(m.content[:100] for m in first_msgs)
                topic_label = conv.topic or "不明"
                conv_summaries.append(f"トピック: {topic_label} / 内容: {msg_preview}")

            prompt = (
                f"以下は相談AIシステムの会話一覧です。これらを{body.n_clusters}つのグループに分類してください。\n"
                "各グループについて、ラベル（日本語）、説明、関連トピック、該当する会話数を返してください。\n"
                "JSON形式で返してください: [{\"label\": \"...\", \"description\": \"...\", \"sample_topics\": [...], \"conversation_count\": N}]\n\n"
                + "\n".join(f"- {s}" for s in conv_summaries)
            )

            response = await client.chat.completions.create(
                model=settings.ai_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1500,
                temperature=0.3,
            )

            import json
            content = response.choices[0].message.content
            # Try to extract JSON from the response
            try:
                clusters = json.loads(content)
            except json.JSONDecodeError:
                # Try extracting JSON from markdown code block
                import re
                json_match = re.search(r'\[.*\]', content, re.DOTALL)
                if json_match:
                    clusters = json.loads(json_match.group())
                else:
                    raise ValueError("Could not parse AI response as JSON")

            return {
                "clusters": clusters,
                "total_conversations": len(conversations),
                "generated_by": "ai",
            }
        except Exception as e:
            logger.warning(f"AI clustering failed, falling back to topic-based: {e}")

    # Topic-based fallback
    topic_groups = {}
    for conv in conversations:
        topic = conv.topic or "不明"
        if topic not in topic_groups:
            topic_groups[topic] = []
        topic_groups[topic].append(conv)

    clusters = []
    for topic, convs in sorted(topic_groups.items(), key=lambda x: -len(x[1])):
        clusters.append({
            "label": topic,
            "conversation_count": len(convs),
            "sample_topics": [topic],
            "description": f"「{topic}」に関する相談 ({len(convs)}件)",
        })

    # Limit to requested number of clusters
    clusters = clusters[:body.n_clusters]

    return {
        "clusters": clusters,
        "total_conversations": len(conversations),
        "generated_by": "topic_based",
    }
