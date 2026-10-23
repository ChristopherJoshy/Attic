"""Knowledge-base preload script for SAHAYI."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

import httpx

sys.path.append(str(Path(__file__).resolve().parents[1]))

from rag.chroma_store import ChromaStore
from rag.pubmed_client import PubMedClient

WHO_GUIDELINES_URL = "https://www.who.int/publications/i/item/9789240015114"
OPENFDA_URL = "https://api.fda.gov/drug/label.json?search=geriatric+use&limit=5"
PUBMED_QUERIES = [
    "elderly India medication adherence",
    "Kerala chronic disease",
    "South Asian geriatric",
]


def chunk_text(text: str, size: int = 512, overlap: int = 50) -> list[str]:
    """Chunk long text into overlapping windows.

    Args:
        text: Source text to chunk.
        size: Chunk size in characters.
        overlap: Overlap between chunks.
    Returns:
        List of chunk strings.
    Agent:
        RAG
    """

    clean = " ".join(text.split())
    step = max(size - overlap, 1)
    return [clean[index : index + size] for index in range(0, len(clean), step) if clean[index : index + size]]


async def fetch_text(url: str) -> str:
    """Fetch plain or HTML text for preload sources.

    Args:
        url: Source URL to fetch.
    Returns:
        Response text content.
    Agent:
        RAG
    """

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # This API call sends a simple GET request and expects text or HTML content back.
            response = await client.get(url)
            response.raise_for_status()
            return response.text
    except Exception:
        return ""


async def fetch_openfda() -> list[dict[str, Any]]:
    """Fetch common drug-interaction summaries from OpenFDA.

    Args:
        None: Uses a fixed OpenFDA query.
    Returns:
        List of OpenFDA result dictionaries.
    Agent:
        RAG
    """

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # This API call sends a label search query and expects drug label summaries back.
            response = await client.get(OPENFDA_URL)
            response.raise_for_status()
            return response.json().get("results", [])
    except Exception:
        return []


async def gather_documents() -> tuple[list[str], list[dict[str, Any]]]:
    """Collect all seed documents and metadata for the knowledge base.

    Args:
        None: Uses configured sources and PubMed queries.
    Returns:
        Tuple of chunk texts and metadata rows.
    Agent:
        RAG
    """

    store_texts: list[str] = []
    store_metadata: list[dict[str, Any]] = []
    pubmed = PubMedClient()
    for query in PUBMED_QUERIES:
        for paper in await pubmed.search(query):
            for chunk in chunk_text(f"{paper['title']} {paper['abstract']}"):
                store_texts.append(chunk)
                store_metadata.append({"source": "pubmed", "query": query, "pmid": paper["pmid"], "title": paper["title"]})
    who_text, openfda = await asyncio.gather(fetch_text(WHO_GUIDELINES_URL), fetch_openfda())
    for chunk in chunk_text(who_text):
        store_texts.append(chunk)
        store_metadata.append({"source": "who", "title": "WHO Medication Safety Guidance"})
    for item in openfda:
        summary = " ".join(item.get("geriatric_use", []) or item.get("drug_interactions", []))
        if summary:
            for chunk in chunk_text(summary):
                store_texts.append(chunk)
                store_metadata.append({"source": "openfda", "set_id": item.get("set_id", "")})
    return store_texts, store_metadata


async def main() -> None:
    """Build and persist the local Chroma knowledge base.

    Args:
        None: Uses configured storage and remote sources.
    Returns:
        None.
    Agent:
        RAG
    """

    store = ChromaStore()
    existing_count = store.count()
    
    if existing_count > 0:
        print(f"Knowledge base already contains {existing_count} chunks. Skipping preload.")
        print("To force reload, delete the chroma_store directory and run again.")
        return
    
    texts, metadatas = await gather_documents()
    store.add(texts, metadatas)
    print(f"Loaded {len(texts)} chunks into ChromaDB.")


if __name__ == "__main__":
    asyncio.run(main())
