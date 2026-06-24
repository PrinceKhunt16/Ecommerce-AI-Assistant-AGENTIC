"""Local embedding model (SentenceTransformers, offline — RAG needs no embedding API)."""

from functools import lru_cache

from langchain_core.embeddings import Embeddings

from app.config import settings


@lru_cache
def get_embeddings() -> Embeddings:
    from langchain_huggingface import HuggingFaceEmbeddings

    return HuggingFaceEmbeddings(
        model_name=settings.rag.embedding_model,
        encode_kwargs={"normalize_embeddings": True},
    )
