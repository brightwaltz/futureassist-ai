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

    @property
    def async_database_url(self) -> str:
        """Convert DATABASE_URL to async format for SQLAlchemy."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
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
