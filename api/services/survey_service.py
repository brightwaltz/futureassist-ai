"""
Survey and Life Ability Evaluation Service.
"""
import logging
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.orm import Survey, QuestionBankEntry
from api.models.schemas import SurveySubmit
from api.utils.scoring import (
    compute_life_ability_score,
    compute_satisfaction_score,
)

logger = logging.getLogger(__name__)


class SurveyService:
    """Handles survey submission, scoring, and retrieval."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_questions(self, category: str = None) -> list[dict]:
        """Fetch active questions, optionally filtered by category."""
        query = select(QuestionBankEntry).where(
            QuestionBankEntry.is_active == True
        ).order_by(QuestionBankEntry.display_order)

        if category:
            query = query.where(QuestionBankEntry.category == category)

        result = await self.db.execute(query)
        questions = result.scalars().all()

        return [
            {
                "id": q.id,
                "category": q.category,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "is_required": q.is_required,
            }
            for q in questions
        ]

    async def submit_survey(self, data: SurveySubmit) -> Survey:
        """
        Process and store survey submission.
        Computes Life Ability and Satisfaction scores.
        """
        answers_dicts = [a.model_dump() for a in data.answers]

        # Separate answers by category for scoring
        life_ability_answers = []
        satisfaction_answers = []

        # Fetch question categories for classification
        question_ids = [a.question_id for a in data.answers]
        if question_ids:
            result = await self.db.execute(
                select(QuestionBankEntry).where(
                    QuestionBankEntry.id.in_(question_ids)
                )
            )
            questions_map = {q.id: q.category for q in result.scalars().all()}

            for answer in data.answers:
                cat = questions_map.get(answer.question_id, "common")
                answer_dict = answer.model_dump()
                if cat in ("life_ability",):
                    life_ability_answers.append(answer_dict)
                elif cat in ("satisfaction",):
                    satisfaction_answers.append(answer_dict)
                else:
                    # Common questions contribute to both
                    life_ability_answers.append(answer_dict)
                    satisfaction_answers.append(answer_dict)

        # Compute scores
        la_score = compute_life_ability_score(life_ability_answers)
        sat_score = compute_satisfaction_score(satisfaction_answers)

        survey = Survey(
            survey_id=uuid4(),
            user_id=data.user_id,
            survey_type=data.survey_type,
            responses=answers_dicts,
            roleplay_data=data.roleplay_data or {},
            life_ability_score=la_score,
            satisfaction_score=sat_score,
        )

        self.db.add(survey)
        await self.db.flush()

        logger.info(
            f"Survey submitted: user={data.user_id}, "
            f"LA={la_score}, SAT={sat_score}"
        )

        return survey

    async def get_user_surveys(self, user_id: int, limit: int = 20) -> list[Survey]:
        """Retrieve survey history for a user."""
        result = await self.db.execute(
            select(Survey)
            .where(Survey.user_id == user_id)
            .order_by(Survey.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
