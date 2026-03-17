"""
Conversation and survey logging service for the v2 admin dashboard.
Writes structured records to conversations, conversation_messages, and survey_responses tables.
"""
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from api.models.orm import Conversation, ConversationMessage, SurveyResponse

logger = logging.getLogger(__name__)


async def log_conversation_start(
    db: AsyncSession,
    tenant_id: UUID,
    session_id: UUID | None,
    user_id: int | None,
    channel: str = "chat",
    topic: str | None = None,
) -> Conversation:
    """Create a Conversation record when a session starts."""
    conv = Conversation(
        tenant_id=tenant_id,
        session_id=session_id,
        user_id=user_id,
        channel=channel,
        topic=topic,
    )
    db.add(conv)
    await db.flush()
    return conv


async def log_message(
    db: AsyncSession,
    conversation_id: UUID,
    tenant_id: UUID,
    sender_type: str,
    content: str,
    nlp_annotations: dict | None = None,
) -> ConversationMessage:
    """Create a ConversationMessage record."""
    msg = ConversationMessage(
        conversation_id=conversation_id,
        tenant_id=tenant_id,
        sender_type=sender_type,
        content=content,
        nlp_annotations=nlp_annotations or {},
    )
    db.add(msg)
    await db.flush()
    return msg


async def log_survey_responses(
    db: AsyncSession,
    tenant_id: UUID,
    survey_id: UUID | None,
    user_id: int | None,
    questions_and_answers: list[dict],
    conversation_id: UUID | None = None,
) -> list[SurveyResponse]:
    """
    Create per-question SurveyResponse rows.
    Each item in questions_and_answers should have:
      question_id, question_text (optional), answer_value, answer_numeric (optional)
    """
    rows = []
    for qa in questions_and_answers:
        row = SurveyResponse(
            tenant_id=tenant_id,
            survey_id=survey_id,
            user_id=user_id,
            conversation_id=conversation_id,
            question_id=str(qa.get("question_id", "")),
            question_text=qa.get("question_text"),
            answer_value=str(qa.get("answer_value", "")),
            answer_numeric=qa.get("answer_numeric"),
        )
        db.add(row)
        rows.append(row)
    await db.flush()
    return rows
