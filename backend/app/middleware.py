"""Request-ID + access-log middleware bound into structlog contextvars."""

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.logging import get_logger

logger = get_logger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id", uuid.uuid4().hex)
        structlog.contextvars.bind_contextvars(request_id=request_id)
        start = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "request",
                method=request.method,
                path=request.url.path,
                elapsed_ms=round(elapsed_ms, 2),
            )
            structlog.contextvars.clear_contextvars()
        response.headers["x-request-id"] = request_id
        return response
