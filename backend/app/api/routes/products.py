"""Product browsing (public)."""

import uuid

from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.product import ProductRead
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
async def list_products(
    session: SessionDep, query: str | None = None, category: str | None = None
) -> list[ProductRead]:
    products = await ProductService(session).search(query=query, category=category)
    return [ProductRead.model_validate(p) for p in products]


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(product_id: uuid.UUID, session: SessionDep) -> ProductRead:
    return ProductRead.model_validate(await ProductService(session).get(product_id))
