"""Product ORM model — the catalog the shopper asks about."""

import uuid
from decimal import Decimal

from sqlalchemy import Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(300), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    category: Mapped[str] = mapped_column(String(100), index=True, default="")
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
