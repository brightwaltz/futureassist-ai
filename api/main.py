"""
FutureAssist AI - Unified FastAPI Application
Render.com deployment version (simplified architecture)

柴田研究室 Service Informatics Lab | 玉川大学
"""
import logging
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select

from api.config import get_settings
from api.database import engine, Base, async_session
from api.routers import users, chat, survey, heroic, metrics, consent, public_sites, ws, admin
from api.models.orm import Tenant, DEFAULT_TENANT_ID
from api.middleware.tenant import TenantMiddleware

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup if they don't exist."""
    logger.info("FutureAssist AI starting up...")
    logger.info(f"AI Backend: {settings.ai_backend} ({settings.ai_model})")

    # Auto-create tables (for Render deployment)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified")

    # Ensure default tenant exists
    async with async_session() as db:
        result = await db.execute(
            select(Tenant).where(Tenant.id == UUID(DEFAULT_TENANT_ID))
        )
        if not result.scalar_one_or_none():
            db.add(Tenant(
                id=UUID(DEFAULT_TENANT_ID),
                name="デフォルト",
                slug="default",
                plan="free",
            ))
            await db.commit()
            logger.info("Default tenant created")
        else:
            logger.info("Default tenant already exists")

    yield
    logger.info("FutureAssist AI shutting down...")


app = FastAPI(
    title="未来アシストAI API",
    description=(
        "コンシェルジュ・コーチングAI - 対話を通じて公的情報へ案内するシステム\n\n"
        "柴田研究室 Service Informatics Lab | 玉川大学"
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Tenant resolution middleware (must be added before CORS)
app.add_middleware(TenantMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routers (all under /api/) ───
app.include_router(users.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(survey.router, prefix="/api")
app.include_router(heroic.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(consent.router, prefix="/api")
app.include_router(public_sites.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# ─── WebSocket ───
app.include_router(ws.router)


@app.get("/api/health", tags=["health"])
async def health_check():
    return {
        "service": "未来アシストAI",
        "version": "2.0.0",
        "status": "operational",
        "lab": "柴田研究室 Service Informatics",
    }


# ─── Serve React Frontend (static files) ───
# In production, Render builds the React app and we serve it from ./static/
import os

static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React SPA - all non-API routes fall through to index.html."""
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
