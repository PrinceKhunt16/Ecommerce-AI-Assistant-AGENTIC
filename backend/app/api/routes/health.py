"""Liveness / readiness probes (public)."""

import redis.asyncio as redis
from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.config import settings
from app.db import engine

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict:
    """Liveness: the process is up. No dependency checks."""
    return {"status": "ok", "app": settings.app_name, "env": settings.environment}


async def _check_db() -> str:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return "ok"
    except Exception as exc:  # noqa: BLE001
        return f"error: {type(exc).__name__}"


async def _check_redis() -> str:
    client = redis.from_url(str(settings.redis_url))
    try:
        await client.ping()
        return "ok"
    except Exception as exc:  # noqa: BLE001
        return f"error: {type(exc).__name__}"
    finally:
        await client.aclose()


@router.get("/ready")
async def ready(response: Response) -> dict:
    """Readiness: verifies Postgres and Redis are reachable."""
    checks = {"database": await _check_db(), "redis": await _check_redis()}
    ok = all(v == "ok" for v in checks.values())
    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ready" if ok else "degraded", "checks": checks}
