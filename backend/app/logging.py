"""Structured logging (structlog) → console + rotating file (``logs/logger.log``)."""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

import structlog

from app.config import settings


def configure_logging() -> None:
    """Configure structlog + stdlib logging once at application startup.

    Logs go to the console (human-friendly in dev, JSON in prod) and to a rotating
    file at ``settings.log_file`` for debugging/tracking.
    """
    log_path = Path(settings.log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    level = logging.DEBUG if settings.debug else logging.INFO

    # Route stdlib logging (uvicorn, sqlalchemy, etc.) through handlers too.
    file_handler = RotatingFileHandler(
        log_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    console_handler = logging.StreamHandler()
    # logging.basicConfig(level=level, handlers=[console_handler, file_handler], force=True)
    logging.basicConfig(level=level, handlers=[console_handler, file_handler])

    # Quiet chatty third-party libraries so our logs stay readable.
    for noisy in (
        "httpcore",
        "httpx",
        "google_genai",
        "google.generativeai",
        "urllib3",
        "sqlalchemy.engine",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    renderer = (
        structlog.processors.JSONRenderer()
        if settings.is_production
        # colors=False keeps the rotating log file clean (no ANSI escape codes).
        else structlog.dev.ConsoleRenderer(colors=False)
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
