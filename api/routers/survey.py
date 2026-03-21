"""
Survey and Life Ability evaluation endpoints.
"""
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.orm import DEFAULT_TENANT_ID
from api.models.schemas import (
    SurveySubmit, SurveyResponse, QuestionBankResponse,
)
from api.services.survey_service import SurveyService
from api.services.logging_service import log_survey_responses
from api.services import point_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/survey", tags=["survey"])


@router.get("/questions", response_model=list[QuestionBankResponse])
async def get_questions(
    category: str = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch survey questions.
    Optionally filter by category: 'common', 'life_ability', 'satisfaction', 'roleplay'.
    """
    service = SurveyService(db)
    questions = await service.get_questions(category)
    return questions


@router.post("/life_ability", response_model=SurveyResponse, status_code=201)
async def submit_life_ability_survey(
    data: SurveySubmit,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a Life Ability evaluation survey.
    Computes life_ability_score and satisfaction_score automatically.
    """
    try:
        service = SurveyService(db)
        survey = await service.submit_survey(data)

        # v2 logging: log per-question responses
        try:
            tenant_id = getattr(request.state, "tenant_id", None) or UUID(DEFAULT_TENANT_ID)
            qa_list = [
                {
                    "question_id": a.question_id,
                    "answer_value": a.value,
                    "answer_numeric": float(a.value) if isinstance(a.value, (int, float)) else None,
                }
                for a in data.answers
            ]
            await log_survey_responses(
                db,
                tenant_id=tenant_id,
                survey_id=survey.survey_id,
                user_id=data.user_id,
                questions_and_answers=qa_list,
            )
        except Exception as e:
            logger.warning(f"Failed to log survey responses: {e}")

        # Award survey completion points
        try:
            await point_service.award_points(
                db, data.user_id, "survey_complete", 50,
                reference_id=str(survey.survey_id),
            )
        except Exception as e:
            logger.warning(f"Failed to award survey points: {e}")

        return survey
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history/{user_id}", response_model=list[SurveyResponse])
async def get_survey_history(
    user_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve survey history for a user."""
    service = SurveyService(db)
    surveys = await service.get_user_surveys(user_id, limit)
    return surveys
