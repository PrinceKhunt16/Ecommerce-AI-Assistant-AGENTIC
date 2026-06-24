"""Knowledge-base chunk ORM model (pgvector).

Policy/FAQ docs from ``data/knowledge`` are chunked, embedded locally, and stored here.
Retrieval orders by cosine distance against the query embedding (see
``app.rag.retriever``). This is the only vector store — no FAISS.
"""

import uuid

from pgvector.sqlalchemy import Vector
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.config import settings
from app.db import Base, TimestampMixin


class KnowledgeChunk(Base, TimestampMixin):
    __tablename__ = "knowledge_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(200), default="")
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.rag.embedding_dim))
