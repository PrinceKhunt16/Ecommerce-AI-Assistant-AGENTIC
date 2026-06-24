"""Data access for products."""

from collections.abc import Sequence

from sqlalchemy import or_, select

from app.models.product import Product
from app.repositories.base import BaseRepository


class ProductRepository(BaseRepository[Product]):
    model = Product

    async def search(
        self, query: str | None = None, category: str | None = None, limit: int = 20
    ) -> Sequence[Product]:
        stmt = select(Product)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(
                    Product.name.ilike(like),
                    Product.description.ilike(like),
                    Product.category.ilike(like),
                )
            )
        if category:
            stmt = stmt.where(Product.category.ilike(category))
        stmt = stmt.order_by(Product.name).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()
