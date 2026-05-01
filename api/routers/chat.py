"""
Chat / Coaching conversation endpoints.

Phase 2: CoachingService.process_message() の直接呼び出しを
AgentGraph.run() に置き換え。レスポンス形式は後方互換を維持。
"""
from __future__ import annotations

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.database import get_db
from api.models.orm import Session, User
from api.models.schemas import (
    ChatRequest, ChatResponse, SessionCreate, SessionResponse,
)
from api.services.agent_graph import AgentGraph
from api.services.agent_state import AgentContext

router = APIRouter(prefix="/chat", tags=["chat"])
settings = get_settings()


def _get_ai_client():
    """設定に応じた AI クライアントを返す。未設定の場合は None。"""
    if settings.ai_backend == "openai" and settings.openai_api_key:
        from openai import AsyncOpenAI
        return AsyncOpenAI(api_key=settings.openai_api_key)
    elif settings.ai_backend == "anthropic" and settings.anthropic_api_key:
        from anthropic import AsyncAnthropic
        return AsyncAnthropic(api_key=settings.anthropic_api_key)
    return None


@router.post("/session", response_model=SessionResponse, status_code=201)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Start a new coaching session for a user."""
    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session = Session(
        session_id=uuid4(),
        user_id=data.user_id,
        topic=data.topic,
        latest_state={"current_step": "worry_triage", "turn": 0},
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.post("/coach", response_model=ChatResponse)
async def coaching_chat(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Main coaching dialogue endpoint.

    Phase 2: AgentGraph (Coaching / Concierge / Critic) を経由して応答を生成。
    pgvector・OPENAI_API_KEY 未設定環境でも FTS フォールバックで動作する。
    """
    # セッション取得（AgentContext 構築に必要）
    result = await db.execute(
        select(Session).where(Session.session_id == data.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 会話履歴を取得
    from api.models.orm import Message
    history_result = await db.execute(
        select(Message)
        .where(Message.session_id == data.session_id)
        .order_by(Message.created_at.desc())
        .limit(20)
    )
    messages = history_result.scalars().all()
    conversation_history = [
        {"role": m.role, "content": m.content}
        for m in reversed(messages)
    ]

    # tenant_id 取得（埋め込み保存に使用）
    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one_or_none()
    tenant_id = user.tenant_id if user else None

    # AgentContext 構築
    ctx = AgentContext(
        session_id=data.session_id,
        user_input=data.user_input,
        topic=session.topic,
        dialogue_state=session.latest_state or {"current_step": "worry_triage", "turn": 0},
        conversation_history=conversation_history,
        ai_client=_get_ai_client(),
        tenant_id=tenant_id,
    )

    # AgentGraph で処理
    graph = AgentGraph(db=db, ai_client=ctx.ai_client)
    try:
        agent_result = await graph.run(ctx)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)}")

    return ChatResponse(
        assistant_reply=agent_result.reply,
        suggested_links=[
            {"title": lnk["title"], "url": lnk["url"]}
            for lnk in agent_result.suggested_links
        ],
        next_question=None,
        emotion_label=agent_result.emotion_label,
        emotion_score=agent_result.emotion_score,
        agent_type=agent_result.routed_to.value,
        confidence=round(agent_result.confidence * 100, 1),
        held=agent_result.held,
    )


@router.get("/session/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get session details."""
    result = await db.execute(
        select(Session).where(Session.session_id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/sessions/user/{user_id}", response_model=list[SessionResponse])
async def get_user_sessions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List all sessions for a user."""
    result = await db.execute(
        select(Session)
        .where(Session.user_id == user_id)
        .order_by(Session.started_at.desc())
    )
    return result.scalars().all()
