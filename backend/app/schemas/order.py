"""Order DTOs."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.order import OrderStatus
from app.schemas.product import ProductRead


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: OrderStatus
    tracking_number: str | None = None
    created_at: datetime
    product: ProductRead
