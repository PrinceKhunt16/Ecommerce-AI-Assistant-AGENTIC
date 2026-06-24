"""LangChain tools the agent can call.

Thin wrappers over repositories — real logic lives in the data layer. Each tool opens
its own DB session. Order tools act for the authenticated user via the
``current_user_id`` ContextVar (set per request in ChatService); they never trust a
user id supplied by the model or customer.
"""

import uuid

from langchain_core.tools import BaseTool, tool

from app.db import sessionmaker
from app.rag.retriever import search_knowledge
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository
from app.security import current_user_id


def _parse_uuid(value: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(value.strip())
    except (ValueError, AttributeError):
        return None


@tool
async def search_products(query: str) -> str:
    """Search the product catalog. Matches the keyword against product name, description,
    or category (e.g. "headphones", "shoes", "electronics").

    Args:
        query: What the customer is looking for.
    """
    async with sessionmaker() as session:
        products = await ProductRepository(session).search(query=query)
    if not products:
        return "No matching products found."
    return "\n".join(
        f"- {p.name} (id={p.id}) | ${p.price} | {p.category} | {p.description[:120]}"
        for p in products
    )


@tool
async def get_product(product_id: str) -> str:
    """Get full details for a single product by its id.

    Args:
        product_id: The product's UUID.
    """
    pid = _parse_uuid(product_id)
    if pid is None:
        return "That product id is not valid."
    async with sessionmaker() as session:
        product = await ProductRepository(session).get(pid)
    if product is None:
        return "No product found with that id."
    return (
        f"{product.name} (id={product.id})\n"
        f"Price: ${product.price}\nCategory: {product.category}\n"
        f"Description: {product.description}"
    )


@tool
async def get_my_orders() -> str:
    """List the logged-in customer's orders with status and tracking number."""
    user_id = _parse_uuid(current_user_id.get() or "")
    if user_id is None:
        return "You must be signed in to view orders."
    async with sessionmaker() as session:
        orders = await OrderRepository(session).list_for_user(user_id)
    if not orders:
        return "You have no orders yet."
    return "\n".join(
        f"- Order {o.id}: {o.product.name} — status={o.status.value}, "
        f"tracking={o.tracking_number or 'not yet assigned'}"
        for o in orders
    )


@tool
async def get_order_status(order_id: str) -> str:
    """Get the status and tracking number of one of the customer's orders.

    Args:
        order_id: The order's UUID (as shown in the customer's order list).
    """
    user_id = _parse_uuid(current_user_id.get() or "")
    if user_id is None:
        return "You must be signed in to view orders."
    oid = _parse_uuid(order_id)
    if oid is None:
        return "That order id is not valid."
    async with sessionmaker() as session:
        order = await OrderRepository(session).get_for_user(oid, user_id)
    if order is None:
        return "No order with that id was found on your account."
    return (
        f"Order {order.id}: {order.product.name}\n"
        f"Status: {order.status.value}\n"
        f"Tracking: {order.tracking_number or 'not yet assigned'}"
    )


@tool
async def search_knowledge_base(query: str) -> str:
    """Search shipping/returns/refund policies and FAQs for relevant information.

    Args:
        query: A focused natural-language question.
    """
    chunks = await search_knowledge(query)
    if not chunks:
        return "No relevant policy information found."
    return "\n\n".join(f"[{c.source}]\n{c.content}" for c in chunks)


def get_tools() -> list[BaseTool]:
    return [
        search_products,
        get_product,
        get_my_orders,
        get_order_status,
        search_knowledge_base,
    ]
