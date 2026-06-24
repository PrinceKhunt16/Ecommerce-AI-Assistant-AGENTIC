"""Knowledge-base ingestion: data/knowledge/*.md → chunks → embeddings → pgvector.

Loads .md/.txt policy docs, splits them, embeds each chunk locally, and replaces the
``knowledge_chunks`` table. Run via ``scripts/seed.py``.
"""

from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.knowledge import KnowledgeChunk
from app.rag.embeddings import get_embeddings
from app.repositories.knowledge_repository import KnowledgeRepository

_SUFFIXES = {".md", ".txt"}


def _load_chunks(knowledge_dir: str | Path) -> list[tuple[str, str]]:
    """Return (content, source) tuples for every chunk under ``knowledge_dir``."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.rag.chunk_size,
        chunk_overlap=settings.rag.chunk_overlap,
    )
    out: list[tuple[str, str]] = []
    for path in sorted(Path(knowledge_dir).rglob("*")):
        if path.suffix.lower() not in _SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8")
        for chunk in splitter.split_text(text):
            out.append((chunk, path.name))
    return out


async def ingest(session: AsyncSession, knowledge_dir: str | None = None) -> int:
    """Rebuild the knowledge base from disk. Returns the number of chunks indexed."""
    chunks = _load_chunks(knowledge_dir or settings.rag.knowledge_dir)
    if not chunks:
        raise FileNotFoundError(
            f"No .md/.txt documents found in {knowledge_dir or settings.rag.knowledge_dir}"
        )

    vectors = get_embeddings().embed_documents([c for c, _ in chunks])
    repo = KnowledgeRepository(session)
    await repo.clear()
    await repo.add_many(
        [
            KnowledgeChunk(content=content, source=source, embedding=vector)
            for (content, source), vector in zip(chunks, vectors, strict=True)
        ]
    )
    return len(chunks)
