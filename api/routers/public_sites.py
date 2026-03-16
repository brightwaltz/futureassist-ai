"""
Public information site directory endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.orm import PublicSite
from api.models.schemas import PublicSiteResponse

router = APIRouter(prefix="/public-sites", tags=["public-sites"])


@router.get("/", response_model=list[PublicSiteResponse])
async def list_public_sites(
    topic: str = None,
    prefecture: str = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List public information sites.
    Optionally filter by topic and/or prefecture.
    """
    query = select(PublicSite).where(PublicSite.is_active == True)

    if topic:
        query = query.where(PublicSite.topic == topic)
    if prefecture:
        query = query.where(PublicSite.prefecture == prefecture)

    result = await db.execute(query.order_by(PublicSite.topic, PublicSite.id))
    return result.scalars().all()


@router.get("/topics")
async def list_topics(db: AsyncSession = Depends(get_db)):
    """List all available topics with site counts."""
    from sqlalchemy import func

    result = await db.execute(
        select(
            PublicSite.topic,
            func.count(PublicSite.id).label("count"),
        )
        .where(PublicSite.is_active == True)
        .group_by(PublicSite.topic)
    )
    return [{"topic": row[0], "count": row[1]} for row in result.all()]
