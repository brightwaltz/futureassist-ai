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
from sqlalchemy import select, text

from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse

from api.config import get_settings
from api.database import engine, Base, async_session
from api.routers import users, chat, survey, heroic, metrics, consent, public_sites, ws, admin, analysis, points, roi, auth
from api.models.orm import Tenant, DEFAULT_TENANT_ID
from api.services.hybrid_search import seed_public_site_embeddings
from api.services.rate_limit import LIMITER
import api.models.points  # noqa: F401 — register ORM models for create_all
import api.models.orm  # noqa: F401 — ensure v3 models (LifeAbilityScore, RoiRecord) are registered
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

    # Add new columns to users table if they don't exist (migration for existing DBs)
    async with engine.begin() as conn:
        for col_name, col_def in [
            ("company", "TEXT NOT NULL DEFAULT ''"),
            ("department", "TEXT"),
            ("position", "TEXT"),
        ]:
            try:
                await conn.execute(
                    text(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
                )
                logger.info(f"Added column users.{col_name}")
            except Exception:
                pass  # Column already exists

    # Add worry_target and guidance fields to public_sites table
    async with engine.begin() as conn:
        for col_name, col_def in [
            ("worry_target", "VARCHAR(100)"),
            ("guidance_reason", "TEXT"),
            ("skip_info", "TEXT"),
        ]:
            try:
                await conn.execute(
                    text(f"ALTER TABLE public_sites ADD COLUMN {col_name} {col_def}")
                )
                logger.info(f"Added column public_sites.{col_name}")
            except Exception:
                pass  # Column already exists

        # Index for worry_target lookup
        try:
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_public_sites_worry_target "
                    "ON public_sites(topic, worry_target) WHERE is_active = TRUE"
                )
            )
            logger.info("Created index idx_public_sites_worry_target")
        except Exception:
            pass  # Index already exists

    # ─── v3.0 HCM Privacy Schema (002) ───
    # 002_hcm_privacy_schema.sql の内容をインライン適用（Render free tier向け）
    async with engine.begin() as conn:
        # pgvector拡張（対応DBのみ。失敗しても続行）
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            logger.info("pgvector extension enabled")
        except Exception as e:
            logger.warning(f"pgvector not available (skipping): {e}")

        # life_ability_scoresテーブル
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS life_ability_scores (
                id              SERIAL PRIMARY KEY,
                user_ext_id     UUID NOT NULL,
                tenant_id       UUID REFERENCES tenants(id) ON DELETE SET NULL,
                s1_info_org     FLOAT CHECK (s1_info_org    BETWEEN 0 AND 100),
                s2_decision     FLOAT CHECK (s2_decision    BETWEEN 0 AND 100),
                s3_action       FLOAT CHECK (s3_action      BETWEEN 0 AND 100),
                s4_stability    FLOAT CHECK (s4_stability   BETWEEN 0 AND 100),
                s5_resource     FLOAT CHECK (s5_resource    BETWEEN 0 AND 100),
                composite_score FLOAT CHECK (composite_score BETWEEN 0 AND 100),
                ema_score       FLOAT CHECK (ema_score      BETWEEN 0 AND 100),
                source          TEXT DEFAULT 'survey',
                survey_id       UUID,
                created_at      TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_la_scores_user "
            "ON life_ability_scores(user_ext_id, created_at DESC)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_la_scores_tenant "
            "ON life_ability_scores(tenant_id, created_at DESC)"
        ))

        # roi_recordsテーブル
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS roi_records (
                id                    SERIAL PRIMARY KEY,
                tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE,
                period_start          DATE NOT NULL,
                period_end            DATE NOT NULL,
                presenteeism_loss_jpy FLOAT,
                absenteeism_loss_jpy  FLOAT,
                estimated_roi_jpy     FLOAT,
                roi_ratio             FLOAT,
                affected_headcount    INT,
                avg_daily_wage_jpy    FLOAT,
                avg_la_score_before   FLOAT,
                avg_la_score_after    FLOAT,
                intervention_cost_jpy FLOAT,
                metadata              JSONB DEFAULT '{}',
                created_at            TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(tenant_id, period_start, period_end)
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_roi_records_tenant "
            "ON roi_records(tenant_id, period_start DESC)"
        ))

        # dashboard_analyticsマテリアライズドビュー（K-匿名性 K=5）
        try:
            await conn.execute(text("""
                CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_analytics AS
                SELECT
                    las.tenant_id,
                    u.age_group,
                    u.department,
                    COUNT(DISTINCT las.user_ext_id)   AS headcount,
                    ROUND(AVG(las.s1_info_org)::NUMERIC, 2)     AS avg_s1,
                    ROUND(AVG(las.s2_decision)::NUMERIC, 2)     AS avg_s2,
                    ROUND(AVG(las.s3_action)::NUMERIC, 2)       AS avg_s3,
                    ROUND(AVG(las.s4_stability)::NUMERIC, 2)    AS avg_s4,
                    ROUND(AVG(las.s5_resource)::NUMERIC, 2)     AS avg_s5,
                    ROUND(AVG(las.composite_score)::NUMERIC, 2) AS avg_composite,
                    ROUND(AVG(las.ema_score)::NUMERIC, 2)       AS avg_ema,
                    MAX(las.created_at)                          AS latest_score_at
                FROM life_ability_scores las
                JOIN users u ON u.external_id = las.user_ext_id
                WHERE las.created_at >= NOW() - INTERVAL '90 days'
                GROUP BY las.tenant_id, u.age_group, u.department
                HAVING COUNT(DISTINCT las.user_ext_id) >= 5
            """))
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_analytics_pk "
                "ON dashboard_analytics(tenant_id, age_group, department)"
            ))
            logger.info("dashboard_analytics materialized view created")
        except Exception as e:
            logger.warning(f"dashboard_analytics view already exists or failed: {e}")

        logger.info("v3.0 HCM schema (002) applied")

    # ─── Phase 2: public_sites に embedding カラムを追加 ───
    # pgvector が使えない環境では try/except でスキップ
    async with engine.begin() as conn:
        try:
            await conn.execute(
                text(f"ALTER TABLE public_sites ADD COLUMN IF NOT EXISTS embedding vector(1536)")
            )
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_public_sites_embedding "
                    "ON public_sites USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)"
                )
            )
            logger.info("public_sites.embedding column & index verified")
        except Exception as e:
            logger.warning(f"public_sites embedding column skipped (pgvector unavailable?): {e}")

    # ─── Phase 2: 起動時に未エンベッドの公的サイトを一括処理 ───
    async with async_session() as db:
        try:
            embedded_count = await seed_public_site_embeddings(db, max_sites=50)
            if embedded_count > 0:
                logger.info(f"HybridSearch: {embedded_count} public sites embedded at startup")
        except Exception as e:
            logger.warning(f"seed_public_site_embeddings failed (non-fatal): {e}")

    # ─── Auth Enhancement (002 migration) ───
    # api/db_migrations/002_auth_enhancement.sql の内容をインライン適用
    async with engine.begin() as conn:
        # users テーブルへ列追加（IF NOT EXISTS で冪等）
        for col_name, col_def in [
            ("password_hash",  "TEXT"),
            ("email_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("totp_secret",    "TEXT"),
            ("mfa_enabled",    "BOOLEAN NOT NULL DEFAULT FALSE"),
            ("google_id",      "TEXT"),
            ("auth_provider",  "TEXT NOT NULL DEFAULT 'password'"),
            ("last_login_at",  "TIMESTAMPTZ"),
        ]:
            try:
                await conn.execute(
                    text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_def}")
                )
            except Exception as e:
                logger.warning(f"users.{col_name} migration skipped: {e}")

        # google_id の UNIQUE 制約は CREATE UNIQUE INDEX で代替（IF NOT EXISTS 利用可能）
        try:
            await conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id "
                "ON users(google_id) WHERE google_id IS NOT NULL"
            ))
        except Exception as e:
            logger.warning(f"users.google_id unique index skipped: {e}")

        # 認証関連テーブル
        for stmt in [
            """CREATE TABLE IF NOT EXISTS refresh_tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash  TEXT NOT NULL UNIQUE,
                issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at  TIMESTAMPTZ NOT NULL,
                revoked_at  TIMESTAMPTZ,
                rotated_to  INT REFERENCES refresh_tokens(id) ON DELETE SET NULL,
                user_agent  TEXT,
                ip_address  TEXT
            )""",
            "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user "
            "ON refresh_tokens(user_id, expires_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active "
            "ON refresh_tokens(user_id) WHERE revoked_at IS NULL",
            """CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash  TEXT NOT NULL UNIQUE,
                issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at  TIMESTAMPTZ NOT NULL,
                consumed_at TIMESTAMPTZ
            )""",
            "CREATE INDEX IF NOT EXISTS idx_email_verification_user "
            "ON email_verification_tokens(user_id, expires_at DESC)",
            """CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash  TEXT NOT NULL UNIQUE,
                issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at  TIMESTAMPTZ NOT NULL,
                consumed_at TIMESTAMPTZ
            )""",
            "CREATE INDEX IF NOT EXISTS idx_password_reset_user "
            "ON password_reset_tokens(user_id, expires_at DESC)",
            # 既存ユーザーを legacy_passwordless としてマーク（password_hash が NULL なら）
            """UPDATE users
                  SET auth_provider = 'legacy_passwordless'
                WHERE password_hash IS NULL
                  AND google_id IS NULL
                  AND auth_provider = 'password'""",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception as e:
                logger.warning(f"auth migration stmt skipped: {e}")

        logger.info("Auth enhancement schema (002) applied")

    # Create points & companion tables if they don't exist
    async with engine.begin() as conn:
        for stmt in [
            """CREATE TABLE IF NOT EXISTS user_points (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                total_points INT DEFAULT 0,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )""",
            """CREATE TABLE IF NOT EXISTS point_history (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL,
                points_earned INT NOT NULL,
                reference_id TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, action_type, reference_id)
            )""",
            """CREATE TABLE IF NOT EXISTS user_companion (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                companion_name TEXT DEFAULT '未名',
                level INT DEFAULT 1,
                experience INT DEFAULT 0,
                mood TEXT DEFAULT 'normal',
                total_points_spent INT DEFAULT 0,
                last_fed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )""",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
        logger.info("Points & companion tables verified")

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
        "Life Ability実践AI - 意思決定の質を高め、対話を通じて公的情報へ案内するシステム\n\n"
        "柴田研究室 Service Informatics Lab | 玉川大学"
    ),
    version="2.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ─── Rate Limiter (slowapi) ───
# Must be registered before routers; LIMITER.limit() decorators on auth endpoints
# read this state via app.state.limiter.
app.state.limiter = LIMITER
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "リクエストが多すぎます。しばらく待ってから再試行してください。"
                f"（制限: {exc.detail}）"
            ),
        },
        headers={"Retry-After": "60"},
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
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(survey.router, prefix="/api")
app.include_router(heroic.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(consent.router, prefix="/api")
app.include_router(public_sites.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
app.include_router(points.router, prefix="/api")
app.include_router(roi.router, prefix="/api")

# ─── WebSocket ───
app.include_router(ws.router)


@app.get("/api/health", tags=["health"])
async def health_check():
    return {
        "service": "未来アシストAI",
        "version": "2.1.0",
        "status": "operational",
        "lab": "柴田研究室 Service Informatics",
    }


# ─── Serve React Frontend (static files) ───
# In production, Render builds the React app and we serve it from ./static/
import os

static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_frontend(full_path: str):
        """Serve React SPA - all non-API routes fall through to index.html."""
        file_path = os.path.join(static_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
