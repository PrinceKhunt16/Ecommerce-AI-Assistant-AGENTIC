"""Seed the database from ``data/``: products, a demo user with orders, and the
knowledge base (policy docs embedded into pgvector).

Idempotent — safe to run repeatedly. Usage:
    uv run python -m scripts.seed
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import sessionmaker
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.models.user import User
from app.rag.ingest import ingest
from app.security import hash_password

PRODUCTS_FILE = Path("data/products.json")
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"


def _load_products() -> list[dict]:
    return json.loads(PRODUCTS_FILE.read_text(encoding="utf-8"))


async def seed_products(session: AsyncSession) -> dict[str, Product]:
    items = _load_products()
    by_name: dict[str, Product] = {}
    for item in items:
        existing = await session.scalar(
            select(Product).where(Product.name == item["name"])
        )
        if existing is not None:
            by_name[item["name"]] = existing
            continue
        product = Product(**item)
        session.add(product)
        by_name[item["name"]] = product
    await session.flush()
    return by_name


async def seed_demo_user(session: AsyncSession) -> User:
    user = await session.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is None:
        user = User(
            email=DEMO_EMAIL,
            name="Demo Shopper",
            password_hash=hash_password(DEMO_PASSWORD),
        )
        session.add(user)
        await session.flush()
    return user


async def seed_orders(
    session: AsyncSession, user: User, products: dict[str, Product]
) -> None:
    if await session.scalar(select(Order).where(Order.user_id == user.id)):
        return  # demo user already has orders
    plan = [
        ("Aurora Wireless Headphones", OrderStatus.SHIPPED, "1Z999AA10123456784"),
        ("Trailblazer Running Shoes", OrderStatus.DELIVERED, "1Z999AA10987654321"),
        ("Everyday Canvas Backpack", OrderStatus.PROCESSING, None),
    ]
    for name, status, tracking in plan:
        product = products.get(name)
        if product is None:
            continue
        session.add(
            Order(
                user_id=user.id,
                product_id=product.id,
                status=status,
                tracking_number=tracking,
            )
        )


async def main() -> None:
    async with sessionmaker() as session:
        products = await seed_products(session)
        user = await seed_demo_user(session)
        await seed_orders(session, user, products)
        chunks = await ingest(session)
        await session.commit()
    print(
        f"✓ Seeded {len(products)} products, demo user ({DEMO_EMAIL} / {DEMO_PASSWORD}) "
        f"with orders, and {chunks} knowledge chunks."
    )


if __name__ == "__main__":
    asyncio.run(main())
