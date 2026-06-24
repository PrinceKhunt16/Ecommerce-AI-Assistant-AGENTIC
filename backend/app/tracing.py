"""LangSmith tracing wiring.

LangChain/LangGraph emit traces to LangSmith when the native ``LANGSMITH_*`` env vars are
set. Per the project convention all config lives in ``app.config.settings``, so we keep a
``langsmith`` settings group and translate it into those env vars here — once, at startup,
before any agent runs. The LangSmith SDK reads the env vars lazily per run, so setting them
in the app lifespan is sufficient.

Tracing is opt-in: with the defaults (``LANGSMITH__TRACING=false``) this is a no-op and the
app behaves exactly as before.
"""

import os

from app.config import settings
from app.logging import get_logger

logger = get_logger(__name__)


def configure_tracing() -> None:
    """Enable LangSmith tracing from ``settings.langsmith`` when configured.

    No-op unless ``LANGSMITH__TRACING=true`` *and* ``LANGSMITH__API_KEY`` are both set, so
    the app runs fine with tracing off (the default).
    """
    cfg = settings.langsmith
    if not cfg.tracing:
        logger.info("tracing.disabled")
        return
    if not cfg.api_key:
        logger.warning("tracing.skipped", reason="LANGSMITH__API_KEY not set")
        return

    os.environ["LANGSMITH_TRACING"] = "true"
    os.environ["LANGSMITH_API_KEY"] = cfg.api_key
    os.environ["LANGSMITH_PROJECT"] = cfg.project
    os.environ["LANGSMITH_ENDPOINT"] = cfg.endpoint
    logger.info("tracing.enabled", project=cfg.project, endpoint=cfg.endpoint)
