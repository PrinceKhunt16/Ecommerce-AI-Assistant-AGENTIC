"""Data access for orders (always scoped to a user)."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select

from app.models.order import Order
from app.repositories.base import BaseRepository


class OrderRepository(BaseRepository[Order]):
    model = Order

    async def list_for_user(self, user_id: uuid.UUID) -> Sequence[Order]:
        result = await self.session.execute(
            select(Order)
            .where(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
        )
        return result.scalars().all()

    async def get_for_user(
        self, order_id: uuid.UUID, user_id: uuid.UUID
    ) -> Order | None:
        result = await self.session.execute(
            select(Order).where(Order.id == order_id, Order.user_id == user_id)
        )
        return result.scalar_one_or_none()
