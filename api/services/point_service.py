"""
Point system and companion management service.
"""
import logging
from datetime import datetime

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from api.models.points import UserPoints, PointHistory, UserCompanion

logger = logging.getLogger(__name__)

# Level-up thresholds: level → cumulative XP required
LEVEL_THRESHOLDS = {
    1: 0,
    2: 50,
    3: 150,
    4: 350,
    5: 700,
}

LEVEL_APPEARANCE = {
    1: {"emoji": "\U0001f95a", "label": "\u5375"},           # 🥚 卵
    2: {"emoji": "\U0001f423", "label": "\u3072\u3088\u3053"},  # 🐣 ひよこ
    3: {"emoji": "\U0001f425", "label": "\u5c0f\u9ce5"},     # 🐥 小鳥
    4: {"emoji": "\U0001f426", "label": "\u6210\u9ce5"},     # 🐦 成鳥
    5: {"emoji": "\u2728\U0001f99c", "label": "\u8f1d\u304f\u9ce5"},  # ✨🦜 輝く鳥
}

FEED_COST = 20
FEED_XP = 10


def _compute_level(experience: int) -> int:
    """Determine level from cumulative experience."""
    level = 1
    for lvl in sorted(LEVEL_THRESHOLDS.keys()):
        if experience >= LEVEL_THRESHOLDS[lvl]:
            level = lvl
    return level


def _xp_for_next_level(level: int, experience: int) -> dict:
    """Return current XP progress toward next level."""
    if level >= 5:
        return {"current": experience, "next_threshold": LEVEL_THRESHOLDS[5], "progress": 1.0}
    current_threshold = LEVEL_THRESHOLDS[level]
    next_threshold = LEVEL_THRESHOLDS[level + 1]
    progress = (experience - current_threshold) / max(next_threshold - current_threshold, 1)
    return {
        "current": experience,
        "next_threshold": next_threshold,
        "progress": min(progress, 1.0),
    }


async def award_points(
    db: AsyncSession,
    user_id: int,
    action_type: str,
    points: int,
    reference_id: str | None = None,
) -> bool:
    """
    Award points to a user. Idempotent via UNIQUE(user_id, action_type, reference_id).
    Returns True if points were awarded, False if duplicate.
    Swallows exceptions to avoid breaking callers.
    """
    try:
        # Insert history (will fail on duplicate)
        history = PointHistory(
            user_id=user_id,
            action_type=action_type,
            points_earned=points,
            reference_id=reference_id,
        )
        db.add(history)
        await db.flush()

        # Upsert user_points
        result = await db.execute(
            select(UserPoints).where(UserPoints.user_id == user_id)
        )
        user_points = result.scalar_one_or_none()
        if user_points:
            user_points.total_points += points
            user_points.updated_at = datetime.utcnow()
        else:
            user_points = UserPoints(user_id=user_id, total_points=points)
            db.add(user_points)

        await db.flush()
        logger.info(f"Awarded {points}pt to user {user_id} for {action_type} (ref={reference_id})")
        return True
    except Exception as e:
        await db.rollback()
        logger.debug(f"Point award skipped (likely duplicate): user={user_id} action={action_type} ref={reference_id}: {e}")
        return False


async def get_user_points(db: AsyncSession, user_id: int) -> dict:
    """Get point balance and recent history."""
    result = await db.execute(
        select(UserPoints).where(UserPoints.user_id == user_id)
    )
    user_points = result.scalar_one_or_none()
    total = user_points.total_points if user_points else 0

    history_result = await db.execute(
        select(PointHistory)
        .where(PointHistory.user_id == user_id)
        .order_by(desc(PointHistory.created_at))
        .limit(20)
    )
    history = history_result.scalars().all()

    return {
        "user_id": user_id,
        "total_points": total,
        "history": [
            {
                "id": h.id,
                "action_type": h.action_type,
                "points_earned": h.points_earned,
                "reference_id": h.reference_id,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            }
            for h in history
        ],
    }


async def get_companion(db: AsyncSession, user_id: int) -> dict:
    """Get companion state, auto-creating if not exists."""
    result = await db.execute(
        select(UserCompanion).where(UserCompanion.user_id == user_id)
    )
    companion = result.scalar_one_or_none()

    if not companion:
        companion = UserCompanion(user_id=user_id)
        db.add(companion)
        await db.flush()
        await db.refresh(companion)

    appearance = LEVEL_APPEARANCE.get(companion.level, LEVEL_APPEARANCE[1])
    xp_info = _xp_for_next_level(companion.level, companion.experience)

    return {
        "user_id": user_id,
        "companion_name": companion.companion_name,
        "level": companion.level,
        "experience": companion.experience,
        "mood": companion.mood,
        "total_points_spent": companion.total_points_spent,
        "last_fed_at": companion.last_fed_at.isoformat() if companion.last_fed_at else None,
        "appearance": appearance,
        "xp_progress": xp_info,
    }


async def feed_companion(db: AsyncSession, user_id: int) -> dict:
    """Feed companion: spend 20pt, gain 10 XP, check level-up."""
    # Check points
    pts_result = await db.execute(
        select(UserPoints).where(UserPoints.user_id == user_id)
    )
    user_points = pts_result.scalar_one_or_none()
    if not user_points or user_points.total_points < FEED_COST:
        raise ValueError("ポイントが不足しています")

    # Get or create companion
    comp_result = await db.execute(
        select(UserCompanion).where(UserCompanion.user_id == user_id)
    )
    companion = comp_result.scalar_one_or_none()
    if not companion:
        companion = UserCompanion(user_id=user_id)
        db.add(companion)
        await db.flush()

    # Deduct points
    user_points.total_points -= FEED_COST
    user_points.updated_at = datetime.utcnow()

    # Add XP and check level
    companion.experience += FEED_XP
    companion.total_points_spent += FEED_COST
    companion.last_fed_at = datetime.utcnow()
    companion.mood = "happy"
    companion.updated_at = datetime.utcnow()

    new_level = _compute_level(companion.experience)
    leveled_up = new_level > companion.level
    companion.level = new_level

    await db.flush()

    appearance = LEVEL_APPEARANCE.get(companion.level, LEVEL_APPEARANCE[1])
    xp_info = _xp_for_next_level(companion.level, companion.experience)

    return {
        "user_id": user_id,
        "companion_name": companion.companion_name,
        "level": companion.level,
        "experience": companion.experience,
        "mood": companion.mood,
        "total_points_spent": companion.total_points_spent,
        "last_fed_at": companion.last_fed_at.isoformat() if companion.last_fed_at else None,
        "appearance": appearance,
        "xp_progress": xp_info,
        "leveled_up": leveled_up,
        "points_remaining": user_points.total_points,
    }


async def rename_companion(db: AsyncSession, user_id: int, new_name: str) -> dict:
    """Rename the companion."""
    result = await db.execute(
        select(UserCompanion).where(UserCompanion.user_id == user_id)
    )
    companion = result.scalar_one_or_none()
    if not companion:
        companion = UserCompanion(user_id=user_id, companion_name=new_name)
        db.add(companion)
    else:
        companion.companion_name = new_name
        companion.updated_at = datetime.utcnow()

    await db.flush()
    return await get_companion(db, user_id)
