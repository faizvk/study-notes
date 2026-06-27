from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "Study Notes"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # Async SQLAlchemy URL (psycopg3 driver works for both async and sync engines).
    DATABASE_URL: str = "postgresql+psycopg://studynotes:studynotes@localhost:5432/studynotes"

    # Auth
    SECRET_KEY: str = "dev-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS — comma-separated list of allowed origins.
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Create tables on startup (handy for first run / dev without migrations).
    AUTO_CREATE_TABLES: bool = True

    # Keep at most this many automatic versions per topic. Checkpoints are never pruned.
    MAX_AUTO_VERSIONS: int = 50

    # Max upload size (megabytes).
    MAX_UPLOAD_MB: int = 10

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        """Accept a provider's raw connection string (e.g. Neon/Supabase give
        ``postgres://`` or ``postgresql://``) and coerce it to the psycopg3 driver
        the app uses, so the env var can be pasted verbatim."""
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://") :]
        self.DATABASE_URL = url
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
