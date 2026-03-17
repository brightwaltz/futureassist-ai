"""
E2E API tests for FutureAssist AI.
Tests basic endpoint availability and auth enforcement.
"""
import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """GET /api/health returns 200."""
    res = await client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "operational"


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
