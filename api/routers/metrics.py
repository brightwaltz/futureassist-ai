"""
Behavioral metrics and well-being tracking endpoints.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.orm import MetricsLogEntry
from api.models.schemas import MetricsLog, MetricsResponse
from api.utils.scoring import compute_wellbeing_index

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.post("/log", response_model=MetricsResponse, status_code=201)
async def log_metrics(
    data: MetricsLog,
    db: AsyncSession = Depends(get_db),
):
    """Log behavioral metrics for a user."""
    entry = MetricsLogEntry(
        user_id=data.user_id,
        chat_frequency=data.chat_frequency,
        consultation_trend=data.consultation_trend,
        stress_level=data.stress_level,
        disposable_income=data.disposable_income,
        disposable_time=data.disposable_time,
        energy_level=data.energy_level,
        health_improvement=data.health_improvement or [],
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.get("/user/{user_id}", response_model=list[MetricsResponse])
async def get_user_metrics(
    user_id: int,
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
):
    """Get metrics history for a user."""
    result = await db.execute(
        select(MetricsLogEntry)
        .where(MetricsLogEntry.user_id == user_id)
        .order_by(MetricsLogEntry.updated_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/wellbeing/{user_id}")
async def get_wellbeing_index(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Compute composite well-being index for a user
    based on latest metrics and survey data.
    """
    from api.models.orm import Survey

    # Get latest metrics
    metrics_result = await db.execute(
        select(MetricsLogEntry)
        .where(MetricsLogEntry.user_id == user_id)
        .order_by(MetricsLogEntry.updated_at.desc())
        .limit(1)
    )
    metrics = metrics_result.scalar_one_or_none()

    # Get latest survey
    survey_result = await db.execute(
        select(Survey)
        .where(Survey.user_id == user_id)
        .order_by(Survey.created_at.desc())
        .limit(1)
    )
    survey = survey_result.scalar_one_or_none()

    if not metrics and not survey:
        raise HTTPException(status_code=404, detail="No data found for user")

    index = compute_wellbeing_index(
        life_ability=survey.life_ability_score if survey else None,
        satisfaction=survey.satisfaction_score if survey else None,
        stress_level=metrics.stress_level if metrics else None,
        energy_level=metrics.energy_level if metrics else None,
    )

    return {
        "user_id": user_id,
        "wellbeing_index": index,
        "components": {
            "life_ability_score": survey.life_ability_score if survey else None,
            "satisfaction_score": survey.satisfaction_score if survey else None,
            "stress_level": metrics.stress_level if metrics else None,
            "energy_level": metrics.energy_level if metrics else None,
        },
        "computed_at": datetime.utcnow().isoformat(),
    }
