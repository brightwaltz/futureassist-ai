"""
Admin API endpoints for the v2 dashboard.
All routes are behind Basic Auth and scoped by tenant slug.
"""
import csv
import io
import logging
import secrets
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy import func, select, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.config import get_settings
from api.database import get_db
from api.models.orm import (
    Tenant, Conversation, ConversationMessage,
    SurveyResponse as SurveyResponseModel,
    QuestionBankEntry,
    Survey, User,
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/admin", tags=["admin"])
security = HTTPBasic()


# ─── Auth dependency ───

def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    """Check Basic Auth credentials against env vars."""
    if not settings.admin_username or not settings.admin_password:
        raise HTTPException(status_code=503, detail="Admin auth not configured")
    username_ok = secrets.compare_digest(credentials.username, settings.admin_username)
    password_ok = secrets.compare_digest(credentials.password, settings.admin_password)
    if not (username_ok and password_ok):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


# ─── Helper: resolve tenant slug → id ───

async def _resolve_tenant(tenant_slug: str, db: AsyncSession) -> UUID:
    result = await db.execute(
        select(Tenant.id).where(Tenant.slug == tenant_slug)
    )
    tenant_id = result.scalar_one_or_none()
    if not tenant_id:
        raise HTTPException(status_code=404, detail=f"Tenant '{tenant_slug}' not found")
    return tenant_id


# ─── GET /api/admin/{tenant_slug}/stats ───

@router.get("/{tenant_slug}/stats")
async def get_stats(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """Dashboard KPIs for a tenant."""
    tid = await _resolve_tenant(tenant_slug, db)

    # Conversation count
    conv_count = (await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.tenant_id == tid)
    )).scalar() or 0

    # Survey count (from surveys table)
    survey_count = (await db.execute(
        select(func.count()).select_from(Survey).where(Survey.tenant_id == tid)
    )).scalar() or 0

    # Active users (distinct user_ids in conversations)
    active_users = (await db.execute(
        select(func.count(func.distinct(Conversation.user_id))).where(
            Conversation.tenant_id == tid,
            Conversation.user_id.isnot(None),
        )
    )).scalar() or 0

    # Average life ability score
    avg_la = (await db.execute(
        select(func.avg(Survey.life_ability_score)).where(
            Survey.tenant_id == tid,
            Survey.life_ability_score.isnot(None),
        )
    )).scalar()

    # Average satisfaction score
    avg_sat = (await db.execute(
        select(func.avg(Survey.satisfaction_score)).where(
            Survey.tenant_id == tid,
            Survey.satisfaction_score.isnot(None),
        )
    )).scalar()

    # Topic distribution
    topic_rows = (await db.execute(
        select(Conversation.topic, func.count()).where(
            Conversation.tenant_id == tid
        ).group_by(Conversation.topic)
    )).all()
    topic_distribution = {(r[0] or "不明"): r[1] for r in topic_rows}

    return {
        "conversation_count": conv_count,
        "survey_count": survey_count,
        "active_users": active_users,
        "avg_life_ability_score": round(avg_la, 2) if avg_la else None,
        "avg_satisfaction_score": round(avg_sat, 2) if avg_sat else None,
        "topic_distribution": topic_distribution,
    }


# ─── GET /api/admin/{tenant_slug}/conversations ───

@router.get("/{tenant_slug}/conversations")
async def list_conversations(
    tenant_slug: str,
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    topic: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """Paginated conversation list with filters."""
    tid = await _resolve_tenant(tenant_slug, db)

    q = select(Conversation).where(Conversation.tenant_id == tid)
    count_q = select(func.count()).select_from(Conversation).where(Conversation.tenant_id == tid)

    if date_from:
        q = q.where(Conversation.started_at >= date_from)
        count_q = count_q.where(Conversation.started_at >= date_from)
    if date_to:
        q = q.where(Conversation.started_at <= date_to)
        count_q = count_q.where(Conversation.started_at <= date_to)
    if topic:
        q = q.where(Conversation.topic == topic)
        count_q = count_q.where(Conversation.topic == topic)
    if channel:
        q = q.where(Conversation.channel == channel)
        count_q = count_q.where(Conversation.channel == channel)

    total = (await db.execute(count_q)).scalar() or 0

    q = q.order_by(Conversation.started_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(q)).scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": str(c.id),
                "session_id": str(c.session_id) if c.session_id else None,
                "user_id": c.user_id,
                "channel": c.channel,
                "topic": c.topic,
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "ended_at": c.ended_at.isoformat() if c.ended_at else None,
            }
            for c in rows
        ],
    }


# ─── GET /api/admin/{tenant_slug}/conversations/{conversation_id} ───

@router.get("/{tenant_slug}/conversations/{conversation_id}")
async def get_conversation(
    tenant_slug: str,
    conversation_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """Full conversation with messages."""
    tid = await _resolve_tenant(tenant_slug, db)

    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.tenant_id == tid)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "id": str(conv.id),
        "session_id": str(conv.session_id) if conv.session_id else None,
        "user_id": conv.user_id,
        "channel": conv.channel,
        "topic": conv.topic,
        "started_at": conv.started_at.isoformat() if conv.started_at else None,
        "ended_at": conv.ended_at.isoformat() if conv.ended_at else None,
        "messages": [
            {
                "id": str(m.id),
                "sender_type": m.sender_type,
                "content": m.content,
                "nlp_annotations": m.nlp_annotations,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in sorted(conv.messages, key=lambda m: m.created_at or datetime.min)
        ],
    }


# ─── GET /api/admin/{tenant_slug}/surveys/stats ───

@router.get("/{tenant_slug}/surveys/stats")
async def get_survey_stats(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """Per-question aggregation: avg, stddev, count.
    question_text は survey_responses に保存されていない場合も
    question_bank テーブルから補完する。
    """
    tid = await _resolve_tenant(tenant_slug, db)

    # ─── 集計クエリ ───
    rows = (await db.execute(
        select(
            SurveyResponseModel.question_id,
            func.max(SurveyResponseModel.question_text).label("question_text"),
            func.avg(SurveyResponseModel.answer_numeric).label("avg_value"),
            func.stddev(SurveyResponseModel.answer_numeric).label("stddev_value"),
            func.count().label("response_count"),
        ).where(
            SurveyResponseModel.tenant_id == tid,
        ).group_by(
            SurveyResponseModel.question_id,
        ).order_by(
            SurveyResponseModel.question_id,
        )
    )).all()

    # ─── question_bank からテキストを補完 ───
    # question_id（文字列 "1","2",…）と question_bank.display_order または id を照合
    qb_rows = (await db.execute(
        select(QuestionBankEntry.id, QuestionBankEntry.question_text)
        .order_by(QuestionBankEntry.display_order, QuestionBankEntry.id)
    )).all()
    # id を文字列キーとして辞書化
    qb_map: dict[str, str] = {str(q.id): q.question_text for q in qb_rows}

    return {
        "questions": [
            {
                "question_id": r.question_id,
                # survey_response の text → question_bank → フォールバック
                "question_text": (
                    r.question_text
                    or qb_map.get(str(r.question_id))
                    or f"質問 {r.question_id}"
                ),
                "avg_value": round(r.avg_value, 2) if r.avg_value is not None else None,
                "stddev_value": round(r.stddev_value, 2) if r.stddev_value is not None else None,
                "response_count": r.response_count,
            }
            for r in rows
        ]
    }


# ─── GET /api/admin/{tenant_slug}/surveys/export ───

@router.get("/{tenant_slug}/surveys/export")
async def export_surveys(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(verify_admin),
):
    """CSV download of all survey_responses for this tenant."""
    tid = await _resolve_tenant(tenant_slug, db)

    rows = (await db.execute(
        select(SurveyResponseModel).where(
            SurveyResponseModel.tenant_id == tid,
        ).order_by(SurveyResponseModel.created_at)
    )).scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "survey_id", "user_id", "conversation_id",
        "question_id", "question_text", "answer_value", "answer_numeric", "created_at",
    ])
    for r in rows:
        writer.writerow([
            str(r.id),
            str(r.survey_id) if r.survey_id else "",
            r.user_id or "",
            str(r.conversation_id) if r.conversation_id else "",
            r.question_id,
            r.question_text or "",
            r.answer_value or "",
            r.answer_numeric if r.answer_numeric is not None else "",
            r.created_at.isoformat() if r.created_at else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=survey_responses.csv"},
    )
