"""Product browsing."""

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.models.product import Product
from app.repositories.product_repository import ProductRepository


class ProductService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ProductRepository(session)

    async def search(
        self, query: str | None = None, category: str | None = None
    ) -> Sequence[Product]:
        return await self.repo.search(query=query, category=category)

    async def get(self, product_id: uuid.UUID) -> Product:
        product = await self.repo.get(product_id)
        if product is None:
            raise NotFoundError("Product not found.")
        return product
