"""
Survey and Life Ability evaluation endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.schemas import (
    SurveySubmit, SurveyResponse, QuestionBankResponse,
)
from api.services.survey_service import SurveyService

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
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a Life Ability evaluation survey.
    Computes life_ability_score and satisfaction_score automatically.
    """
    try:
        survey = await service_submit(data, db)
        return survey
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def service_submit(data: SurveySubmit, db: AsyncSession):
    service = SurveyService(db)
    return await service.submit_survey(data)


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
