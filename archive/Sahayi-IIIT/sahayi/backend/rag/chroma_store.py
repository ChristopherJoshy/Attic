"""Local persistent vector-store wrapper for SAHAYI retrieval."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from core.config import get_settings
from rag.embeddings import embed_texts


class ChromaStore:
    """Persistent vector-store wrapper used by SAHAYI agents.

    Args:
        None: Uses environment-backed persistence settings.
    Returns:
        ChromaStore instance with a persistent local collection.
    Agent:
        RAG
    """

    def __init__(self) -> None:
        """Initialise the persistent vector store.

        Args:
            None: Uses configured persist directory and collection name.
        Returns:
            None.
        Agent:
            RAG
        """

        settings = get_settings()
        self.persist_dir = Path(settings.chroma_persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.persist_dir / f"{settings.chroma_collection_name}.json"
        self.records = self._load()

    def add(self, texts: list[str], metadatas: list[dict[str, Any]]) -> None:
        """Add documents into the local collection.

        Args:
            texts: Text chunks to persist.
            metadatas: Metadata objects aligned to each chunk.
        Returns:
            None.
        Agent:
            RAG
        """

        for index, (text, metadata, embedding) in enumerate(zip(texts, metadatas, embed_texts(texts))):
            self.records.append({"id": f"doc-{len(self.records) + index}", "text": text, "metadata": metadata, "embedding": embedding})
        self._save()

    def query(self, text: str, n_results: int = 5) -> list[dict[str, Any]]:
        """Query the collection for relevant chunks.

        Args:
            text: Natural-language search text.
            n_results: Number of chunks to return.
        Returns:
            List of retrieved chunk dictionaries.
        Agent:
            RAG
        """

        query_embedding = embed_texts([text])[0]
        scored = sorted(self.records, key=lambda record: self._distance(query_embedding, record["embedding"]))
        return [{"text": record["text"], "metadata": record["metadata"], "distance": self._distance(query_embedding, record["embedding"])} for record in scored[:n_results]]

    def count(self) -> int:
        """Return the number of stored documents.

        Args:
            None: Uses in-memory records loaded from disk.
        Returns:
            Number of stored documents.
        Agent:
            RAG
        """

        return len(self.records)

    def _load(self) -> list[dict[str, Any]]:
        """Load persisted records from disk.

        Args:
            None: Uses configured collection file path.
        Returns:
            List of record dictionaries.
        Agent:
            RAG
        """

        return json.loads(self.path.read_text(encoding="utf-8")) if self.path.exists() else []

    def _save(self) -> None:
        """Persist current records to disk.

        Args:
            None: Uses configured collection file path.
        Returns:
            None.
        Agent:
            RAG
        """

        self.path.write_text(json.dumps(self.records), encoding="utf-8")

    def _distance(self, left: list[float], right: list[float]) -> float:
        """Compute cosine distance between two vectors.

        Args:
            left: First vector.
            right: Second vector.
        Returns:
            Cosine distance in the 0-2 range.
        Agent:
            RAG
        """

        dot = sum(l * r for l, r in zip(left, right))
        left_norm = math.sqrt(sum(item * item for item in left)) or 1.0
        right_norm = math.sqrt(sum(item * item for item in right)) or 1.0
        return 1 - (dot / (left_norm * right_norm))
