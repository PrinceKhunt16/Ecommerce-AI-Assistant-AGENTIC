"""Data access for knowledge chunks (pgvector cosine similarity search)."""

from collections.abc import Sequence

from sqlalchemy import delete, select

from app.models.knowledge import KnowledgeChunk
from app.repositories.base import BaseRepository


class KnowledgeRepository(BaseRepository[KnowledgeChunk]):
    model = KnowledgeChunk

    async def clear(self) -> None:
        await self.session.execute(delete(KnowledgeChunk))

    async def add_many(self, chunks: list[KnowledgeChunk]) -> None:
        self.session.add_all(chunks)
        await self.session.flush()

    async def search(
        self, embedding: list[float], k: int = 4
    ) -> Sequence[KnowledgeChunk]:
        """Return the ``k`` chunks closest to ``embedding`` by cosine distance."""
        result = await self.session.execute(
            select(KnowledgeChunk)
            .order_by(KnowledgeChunk.embedding.cosine_distance(embedding))
            .limit(k)
        )
        return result.scalars().all()
