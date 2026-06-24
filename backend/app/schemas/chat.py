"""Chat DTOs."""

import uuid

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: uuid.UUID | None = Field(
        default=None,
        description="Existing conversation to continue; a new one is created if omitted.",
    )
