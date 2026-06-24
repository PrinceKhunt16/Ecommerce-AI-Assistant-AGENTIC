"""Product DTOs."""

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    price: Decimal
    category: str
    image_url: str | None = None
