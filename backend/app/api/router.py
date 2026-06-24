"""API v1 router aggregation.

Auth is enforced per-route via the ``CurrentUser`` dependency (orders, conversations).
Health, auth, and product browsing are public. Chat is WebSocket-only (``ws.router``),
which handles auth internally via the ``token`` query param.
"""

from fastapi import APIRouter

from app.api.routes import (
    auth,
    conversations,
    health,
    orders,
    products,
    ws,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(products.router)
api_router.include_router(orders.router)
api_router.include_router(conversations.router)
api_router.include_router(ws.router)
