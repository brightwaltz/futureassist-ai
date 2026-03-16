"""
Chat / Coaching conversation endpoints.
"""
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.orm import Session, User
from api.models.schemas import (
    ChatRequest, ChatResponse, SessionCreate, SessionResponse,
)
from api.services.coaching_service import CoachingService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/session", response_model=SessionResponse, status_code=201)
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Start a new coaching session for a user."""
    # Verify user exists and has consent
    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    session = Session(
        session_id=uuid4(),
        user_id=data.user_id,
        topic=data.topic,
        latest_state={"current_step": "identify_concern", "turn": 0},
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
    Processes user input through the coaching state machine
    and returns a contextual response with optional public site links.
    """
    service = CoachingService(db)

    try:
        result = await service.process_message(
            session_id=data.session_id,
            user_input=data.user_input,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Coaching engine error: {str(e)}")

    return ChatResponse(
        assistant_reply=result["assistant_reply"],
        suggested_links=result.get("suggested_links", []),
        next_question=result.get("next_question"),
        emotion_label=result.get("emotion_label"),
        emotion_score=result.get("emotion_score"),
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
