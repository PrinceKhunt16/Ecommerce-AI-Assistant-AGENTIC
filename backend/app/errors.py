"""Domain exceptions and global exception handlers.

Keeps error responses consistent (a ``{detail, code, request_id}`` body) and ensures
unexpected errors are logged but never leak internals to clients.
"""

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    """Base class for expected, client-facing domain errors."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "app_error"

    def __init__(self, detail: str, *, code: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        if code:
            self.code = code


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "unauthorized"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class ServiceUnavailableError(AppError):
    """Upstream dependency (e.g. the LLM provider) is temporarily unavailable.

    Used to turn an LLM rate-limit (e.g. a Gemini 429) into a clean, client-facing 503
    instead of leaking a raw traceback.
    """

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"


_RATE_LIMIT_MARKERS = (
    "429",
    "rate limit",
    "resource_exhausted",
    "resourceexhausted",
    "quota",
    "exhausted",
)


def friendly_llm_error(exc: Exception) -> str:
    """A short, client-safe message for an LLM-provider failure.

    Keeps raw provider tracebacks out of the response while still telling the user what
    to do. Rate-limit / quota errors (e.g. a Gemini free-tier 429) get a distinct hint.
    """
    text = str(exc).lower()
    if any(marker in text for marker in _RATE_LIMIT_MARKERS):
        return (
            "The assistant is getting a lot of requests right now and hit a rate limit. "
            "Please wait a moment and try again."
        )
    return "Sorry, the assistant is temporarily unavailable. Please try again in a moment."


def _request_id() -> str | None:
    return structlog.contextvars.get_contextvars().get("request_id")


def _error_body(detail: str, code: str) -> dict:
    return {"detail": detail, "code": code, "request_id": _request_id()}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code, content=_error_body(exc.detail, exc.code)
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_body(str(exc.detail), "http_error"),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Request validation failed.",
                "code": "validation_error",
                "request_id": _request_id(),
                "errors": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_error_body("Internal server error.", "internal_error"),
        )
