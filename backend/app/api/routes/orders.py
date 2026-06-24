"""Order endpoints (the signed-in customer's own orders)."""

import uuid

from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.order import OrderRead
from app.security import CurrentUser
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderRead])
async def my_orders(user: CurrentUser, session: SessionDep) -> list[OrderRead]:
    orders = await OrderService(session).list_for_user(user.id)
    return [OrderRead.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderRead)
async def my_order(
    order_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> OrderRead:
    order = await OrderService(session).get_for_user(order_id, user.id)
    return OrderRead.model_validate(order)
