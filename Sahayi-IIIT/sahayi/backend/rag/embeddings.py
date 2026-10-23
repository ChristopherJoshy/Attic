"""Embedding helpers for SAHAYI."""

from __future__ import annotations

import hashlib
from functools import lru_cache

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - optional fast path only.
    SentenceTransformer = None


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of text strings.

    Args:
        texts: Text strings to embed.
    Returns:
        Dense vector embeddings as Python lists.
    Agent:
        RAG
    """

    if not texts:
        return []
    if SentenceTransformer:
        return _get_embedding_model().encode(texts, normalize_embeddings=True).tolist()
    return [_hash_embedding(text) for text in texts]


@lru_cache(maxsize=1)
def _get_embedding_model() -> SentenceTransformer:
    """Load and cache the sentence-transformer model when available.

    Args:
        None: Uses the fixed local embedding model name.
    Returns:
        Loaded SentenceTransformer instance.
    Agent:
        RAG
    """

    return SentenceTransformer("all-MiniLM-L6-v2")


def _hash_embedding(text: str) -> list[float]:
    """Build a deterministic lightweight fallback embedding.

    Args:
        text: Input text string.
    Returns:
        Dense pseudo-embedding vector.
    Agent:
        RAG
    """

    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return [((digest[index % len(digest)] / 255.0) * 2) - 1 for index in range(128)]
