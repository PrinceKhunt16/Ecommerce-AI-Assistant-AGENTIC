"""Light test for knowledge chunking (no embedding model / DB needed)."""

from app.rag.ingest import _load_chunks


def test_load_chunks_from_knowledge_dir():
    chunks = _load_chunks("data/knowledge")
    assert chunks, "expected at least one chunk from data/knowledge"
    assert all(
        isinstance(content, str) and content for content, _ in chunks
    )
    assert all(source.endswith((".md", ".txt")) for _, source in chunks)
