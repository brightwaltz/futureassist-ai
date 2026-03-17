"""
E2E API tests for FutureAssist AI.
Tests basic endpoint availability, auth enforcement, and Life Ability scoring.
"""
import pytest

from api.utils.scoring import compute_life_ability_5elements, LIFE_ABILITY_WEIGHTS


@pytest.mark.asyncio
async def test_health_check(client):
    """GET /api/health returns 200 with version 2.1.0."""
    res = await client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"
    assert data["version"] == "2.1.0"


@pytest.mark.asyncio
async def test_admin_stats_unauthorized(client):
    """GET /api/admin/default/stats without auth returns 401."""
    res = await client.get("/api/admin/default/stats")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_stats_no_credentials_configured(client):
    """Admin returns 401 or 503 when no credentials provided."""
    res = await client.get("/api/admin/default/stats")
    # Without ADMIN_USERNAME/PASSWORD env vars, should get 401 (no auth header)
    # or 503 (admin auth not configured)
    assert res.status_code in (401, 403, 503)


@pytest.mark.asyncio
async def test_survey_questions(client):
    """GET /api/survey/questions returns 200 (requires DB)."""
    try:
        res = await client.get("/api/survey/questions")
        assert res.status_code == 200
    except OSError:
        pytest.skip("Database not available")


@pytest.mark.asyncio
async def test_analysis_summarize_unauthorized(client):
    """POST /api/admin/default/analysis/summarize without auth returns 401."""
    res = await client.post(
        "/api/admin/default/analysis/summarize",
        json={},
    )
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_analysis_cluster_unauthorized(client):
    """POST /api/admin/default/analysis/cluster without auth returns 401."""
    res = await client.post(
        "/api/admin/default/analysis/cluster",
        json={},
    )
    assert res.status_code in (401, 403)


# ─── Life Ability 5-Element Scoring Tests ───

def test_life_ability_5elements_all_elements():
    """compute_life_ability_5elements returns scores for all 5 elements."""
    answers = [
        {"element": "information_organizing", "value": 4},
        {"element": "information_organizing", "value": 5},
        {"element": "decision_satisfaction", "value": 3},
        {"element": "decision_satisfaction", "value": 4},
        {"element": "action_bridging", "value": 5},
        {"element": "action_bridging", "value": 5},
        {"element": "life_stability", "value": 2},
        {"element": "life_stability", "value": 3},
        {"element": "resource_optimization", "value": 4},
        {"element": "resource_optimization", "value": 4},
    ]
    result = compute_life_ability_5elements(answers)

    assert result["information_organizing"] == 90.0   # (4+5)/(2*5)*100
    assert result["decision_satisfaction"] == 70.0     # (3+4)/(2*5)*100
    assert result["action_bridging"] == 100.0          # (5+5)/(2*5)*100
    assert result["life_stability"] == 50.0            # (2+3)/(2*5)*100
    assert result["resource_optimization"] == 80.0     # (4+4)/(2*5)*100
    assert result["total"] is not None
    assert 0 <= result["total"] <= 100


def test_life_ability_5elements_partial():
    """compute_life_ability_5elements handles partial answers."""
    answers = [
        {"element": "information_organizing", "value": 5},
        {"element": "decision_satisfaction", "value": 3},
    ]
    result = compute_life_ability_5elements(answers)

    assert result["information_organizing"] == 100.0
    assert result["decision_satisfaction"] == 60.0
    assert result["action_bridging"] is None
    assert result["life_stability"] is None
    assert result["resource_optimization"] is None
    assert result["total"] is not None


def test_life_ability_5elements_empty():
    """compute_life_ability_5elements handles empty answers."""
    result = compute_life_ability_5elements([])

    for key in LIFE_ABILITY_WEIGHTS:
        assert result[key] is None
    assert result["total"] is None


def test_life_ability_weights_sum():
    """LIFE_ABILITY_WEIGHTS should sum to 1.0."""
    assert abs(sum(LIFE_ABILITY_WEIGHTS.values()) - 1.0) < 0.001
