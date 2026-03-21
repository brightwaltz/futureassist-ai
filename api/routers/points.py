"""
Points and companion endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.services import point_service

router = APIRouter(tags=["points"])


class AwardPointsRequest(BaseModel):
    user_id: int
    action_type: str
    points: int
    reference_id: str | None = None


class RenameRequest(BaseModel):
    name: str


# ─── Points ───

@router.get("/points/{user_id}")
async def get_points(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get point balance and recent history."""
    return await point_service.get_user_points(db, user_id)


@router.post("/points/award")
async def award_points(data: AwardPointsRequest, db: AsyncSession = Depends(get_db)):
    """Manually award points (admin use)."""
    result = await point_service.award_points(
        db, data.user_id, data.action_type, data.points, data.reference_id
    )
    return {"awarded": result}


# ─── Companion ───

@router.get("/companion/{user_id}")
async def get_companion(user_id: int, db: AsyncSession = Depends(get_db)):
    """Get companion state."""
    return await point_service.get_companion(db, user_id)


@router.post("/companion/{user_id}/feed")
async def feed_companion(user_id: int, db: AsyncSession = Depends(get_db)):
    """Feed companion (costs 20pt, gains 10 XP)."""
    try:
        return await point_service.feed_companion(db, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/companion/{user_id}/rename")
async def rename_companion(user_id: int, data: RenameRequest, db: AsyncSession = Depends(get_db)):
    """Rename companion."""
    return await point_service.rename_companion(db, user_id, data.name)
