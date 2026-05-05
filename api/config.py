"""Application configuration from environment variables."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database (Render provides DATABASE_URL directly)
    database_url: str = "postgresql+asyncpg://localhost/futureassist"

    # AI Backend
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ai_backend: str = "openai"
    ai_model: str = "gpt-4-turbo"

    # HEROIC
    heroic_api_url: str = ""
    heroic_api_key: str = ""
    heroic_encryption_key: str = ""

    # Application
    app_env: str = "production"
    app_secret_key: str = "change-me-in-production"
    cors_origins: str = "*"
    port: int = 10000  # Render default

    # Admin auth (simple Basic Auth for admin dashboard)
    admin_username: str = ""
    admin_password: str = ""

    # ─── Auth Enhancement: JWT ─────────────────────────────────────────────
    jwt_secret: str = ""          # If empty, falls back to app_secret_key at runtime
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 15  # 15 minutes
    jwt_refresh_ttl_days: int = 7

    # ─── Auth Enhancement: SMTP (email verify / password reset) ──────────
    smtp_host: str = ""           # e.g. "smtp.gmail.com"
    smtp_port: int = 587          # STARTTLS
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""           # e.g. "no-reply@futureassist-ai.com"
    smtp_use_tls: bool = True

    # ─── Auth Enhancement: Frontend URL (for verify/reset links) ────────
    frontend_url: str = "https://futureassist-ai.onrender.com"

    # ─── Auth Enhancement: Google OAuth ──────────────────────────────────
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""  # default computed: {frontend_url}/auth/google/callback

    @property
    def jwt_signing_key(self) -> str:
        """Return JWT secret with fallback to app_secret_key."""
        return self.jwt_secret or self.app_secret_key

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password and self.smtp_from)

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def google_redirect_url(self) -> str:
        return self.google_redirect_uri or f"{self.frontend_url.rstrip('/')}/auth/google/callback"

    @property
    def async_database_url(self) -> str:
        """Convert DATABASE_URL to async format for SQLAlchemy."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Neon requires SSL; asyncpg uses 'ssl=require' (not 'sslmode')
        if "neon" in url:
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            parsed = urlparse(url)
            params = parse_qs(parsed.query, keep_blank_values=True)
            # Remove params not supported by asyncpg
            for drop in ('sslmode', 'channel_binding'):
                params.pop(drop, None)
            # Ensure ssl=require is present
            params['ssl'] = ['require']
            new_query = urlencode(params, doseq=True)
            url = urlunparse(parsed._replace(query=new_query))
        return url

    @property
    def sync_database_url(self) -> str:
        url = self.database_url
        if "+asyncpg" in url:
            url = url.replace("+asyncpg", "")
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
