"""
Tests for the point system and companion service.
Uses mocked async DB session.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from api.services.point_service import (
    award_points,
    get_user_points,
    get_companion,
    feed_companion,
    rename_companion,
    _compute_level,
    _xp_for_next_level,
    FEED_COST,
    FEED_XP,
    LEVEL_THRESHOLDS,
)


# ─── Unit tests for helper functions ───

def test_compute_level_boundaries():
    """Level computation at exact thresholds."""
    assert _compute_level(0) == 1
    assert _compute_level(49) == 1
    assert _compute_level(50) == 2
    assert _compute_level(149) == 2
    assert _compute_level(150) == 3
    assert _compute_level(349) == 3
    assert _compute_level(350) == 4
    assert _compute_level(699) == 4
    assert _compute_level(700) == 5
    assert _compute_level(9999) == 5


def test_xp_for_next_level_progress():
    """XP progress calculation."""
    info = _xp_for_next_level(1, 25)
    assert info["current"] == 25
    assert info["next_threshold"] == 50
    assert info["progress"] == 0.5

    info_max = _xp_for_next_level(5, 1000)
    assert info_max["progress"] == 1.0


# ─── Async tests with mocked DB ───

def _make_mock_db():
    """Create a mock AsyncSession."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.rollback = AsyncMock()
    return db


def _mock_execute_returning(value):
    """Create a mock execute result that returns a scalar."""
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


@pytest.mark.asyncio
async def test_award_points_success():
    """award_points correctly awards points and updates balance."""
    db = _make_mock_db()

    # First call: no existing UserPoints record
    existing_points = None
    db.execute = AsyncMock(
        return_value=_mock_execute_returning(existing_points)
    )

    result = await award_points(db, user_id=1, action_type="daily_login", points=10, reference_id="2026-03-21")

    assert result is True
    # Should have called db.add twice (PointHistory + UserPoints)
    assert db.add.call_count == 2
    assert db.flush.call_count == 2


@pytest.mark.asyncio
async def test_award_points_duplicate_prevented():
    """Duplicate award (same user_id, action_type, reference_id) is handled gracefully."""
    db = _make_mock_db()

    # Simulate IntegrityError on flush (duplicate UNIQUE constraint)
    from sqlalchemy.exc import IntegrityError
    db.flush = AsyncMock(side_effect=IntegrityError("dup", {}, None))

    result = await award_points(db, user_id=1, action_type="daily_login", points=10, reference_id="2026-03-21")

    assert result is False
    db.rollback.assert_called_once()


@pytest.mark.asyncio
async def test_feed_companion_insufficient_points():
    """feed_companion raises ValueError when points are insufficient."""
    db = _make_mock_db()

    # Mock UserPoints with only 10 points (need 20)
    mock_points = MagicMock()
    mock_points.total_points = 10

    db.execute = AsyncMock(
        return_value=_mock_execute_returning(mock_points)
    )

    with pytest.raises(ValueError, match="ポイントが不足"):
        await feed_companion(db, user_id=1)


@pytest.mark.asyncio
async def test_feed_companion_success():
    """feed_companion deducts points, adds XP, and updates mood."""
    db = _make_mock_db()

    mock_points = MagicMock()
    mock_points.total_points = 100

    mock_companion = MagicMock()
    mock_companion.experience = 40
    mock_companion.level = 1
    mock_companion.total_points_spent = 0
    mock_companion.companion_name = "テスト"
    mock_companion.mood = "normal"
    mock_companion.last_fed_at = None

    call_count = 0

    async def mock_execute(query):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _mock_execute_returning(mock_points)
        else:
            return _mock_execute_returning(mock_companion)

    db.execute = mock_execute

    result = await feed_companion(db, user_id=1)

    assert mock_points.total_points == 100 - FEED_COST
    assert mock_companion.experience == 40 + FEED_XP
    assert mock_companion.mood == "happy"
    # 50 XP → level 2
    assert mock_companion.level == 2
    assert result["leveled_up"] is True
