"""Application configuration.

All settings come from environment variables (and a local ``.env`` in development) via
``pydantic-settings``. Nested groups use the ``__`` delimiter, e.g. ``GEMINI__API_KEY``.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _config(env_prefix: str = "") -> SettingsConfigDict:
    """Shared pydantic-settings config, optionally scoped to a nested env prefix."""
    return SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
        env_prefix=env_prefix,
    )


class GeminiSettings(BaseSettings):
    """Gemini configuration (Google AI Studio free tier; chat only — embeddings stay local)."""

    model_config = _config("GEMINI__")

    api_key: str = ""
    model: str = "gemini-2.5-flash"


class LangSmithSettings(BaseSettings):
    """LangSmith tracing/observability (optional; off by default).

    These map onto the native ``LANGSMITH_*`` env vars that the LangChain/LangSmith SDK
    reads — the translation happens once at startup in ``app.tracing.configure_tracing``.
    Tracing is only enabled when ``tracing`` is true *and* an ``api_key`` is set.
    """

    model_config = _config("LANGSMITH__")

    tracing: bool = False
    api_key: str = ""
    project: str = "ecommerce-support-chatbot"
    endpoint: str = "https://api.smith.langchain.com"


class RAGSettings(BaseSettings):
    """Retrieval config. Embeddings run locally (offline); vectors live in pgvector."""

    model_config = _config("RAG__")

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384
    chunk_size: int = 800
    chunk_overlap: int = 150
    top_k: int = 4
    knowledge_dir: str = "data/knowledge"


class Settings(BaseSettings):
    """Top-level application settings."""

    model_config = _config()

    # --- App ---
    app_name: str = "Ecommerce Support Chatbot"
    environment: str = Field(default="development")
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- Datastores ---
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/support"
    redis_url: str = "redis://localhost:6379/0"
    # Create tables on startup (dev convenience). Use scripts/init_db.py otherwise.
    db_auto_create: bool = False

    # --- LLM (Gemini only) ---
    gemini: GeminiSettings = Field(default_factory=GeminiSettings)

    # --- RAG ---
    rag: RAGSettings = Field(default_factory=RAGSettings)

    # --- Observability (LangSmith tracing; optional) ---
    langsmith: LangSmithSettings = Field(default_factory=LangSmithSettings)

    # --- Auth (JWT) ---
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    # --- Agent / memory ---
    max_agent_iterations: int = 6
    conversation_ttl_seconds: int = 60 * 60 * 24  # 24h Redis short-term window
    memory_enabled: bool = True

    # --- Logging ---
    log_file: str = "logs/logger.log"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (FastAPI dependency-friendly)."""
    return Settings()


settings = get_settings()
