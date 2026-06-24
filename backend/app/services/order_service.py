"""Order lookups — always scoped to the authenticated user."""

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.models.order import Order
from app.repositories.order_repository import OrderRepository


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = OrderRepository(session)

    async def list_for_user(self, user_id: uuid.UUID) -> Sequence[Order]:
        return await self.repo.list_for_user(user_id)

    async def get_for_user(self, order_id: uuid.UUID, user_id: uuid.UUID) -> Order:
        order = await self.repo.get_for_user(order_id, user_id)
        if order is None:
            raise NotFoundError("Order not found.")
        return order
