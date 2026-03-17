import pytest
import httpx
from api.main import app


@pytest.fixture
def client():
    """Async HTTP client for testing the FastAPI app."""
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    )
