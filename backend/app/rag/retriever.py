"""Query-time retrieval: embed the query, then pgvector cosine search."""

import asyncio
from dataclasses import dataclass

from app.config import settings
from app.db import sessionmaker
from app.rag.embeddings import get_embeddings
from app.repositories.knowledge_repository import KnowledgeRepository


@dataclass
class RetrievedChunk:
    content: str
    source: str


async def search_knowledge(query: str, k: int | None = None) -> list[RetrievedChunk]:
    """Return the top-k knowledge chunks most relevant to ``query``."""
    k = k or settings.rag.top_k
    # Embedding inference is CPU-bound; keep it off the event loop.
    vector = await asyncio.to_thread(get_embeddings().embed_query, query)
    async with sessionmaker() as session:
        rows = await KnowledgeRepository(session).search(vector, k)
    return [RetrievedChunk(content=r.content, source=r.source) for r in rows]
