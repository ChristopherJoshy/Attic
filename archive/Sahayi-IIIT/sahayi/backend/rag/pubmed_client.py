"""PubMed client for SAHAYI research retrieval."""

from __future__ import annotations

import asyncio

from Bio import Entrez

from core.config import get_settings


class PubMedClient:
    """Minimal PubMed API client for SAHAYI.

    Args:
        None: Uses configured email and result limits.
    Returns:
        PubMedClient instance.
    Agent:
        RAG
    """

    def __init__(self) -> None:
        """Initialise the PubMed client state.

        Args:
            None: Uses environment-backed PubMed settings.
        Returns:
            None.
        Agent:
            RAG
        """

        settings = get_settings()
        Entrez.email = settings.pubmed_email or "sahayi@example.com"
        self.max_results = settings.pubmed_max_results

    async def search(self, query: str, max_results: int | None = None) -> list[dict[str, str]]:
        """Search PubMed and return recent abstract records.

        Args:
            query: PubMed search query string.
            max_results: Optional result-count override.
        Returns:
            List of paper dictionaries with title, year, abstract, and PMID.
        Agent:
            RAG
        """

        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._search_sync, query, max_results or self.max_results),
                timeout=12,
            )
        except Exception:
            return []

    def _search_sync(self, query: str, max_results: int) -> list[dict[str, str]]:
        """Run the blocking PubMed search and fetch workflow.

        Args:
            query: PubMed search query string.
            max_results: Number of abstracts to fetch.
        Returns:
            List of paper dictionaries.
        Agent:
            RAG
        """

        # This API call sends the clinical query string and expects PubMed IDs back.
        with Entrez.esearch(db="pubmed", term=query, sort="pub date", retmax=max_results) as handle:
            ids = Entrez.read(handle).get("IdList", [])
        if not ids:
            return []
        # This API call sends PubMed IDs and expects structured article metadata and abstract text back.
        with Entrez.efetch(db="pubmed", id=",".join(ids), rettype="abstract", retmode="xml") as handle:
            records = Entrez.read(handle)
        articles = records.get("PubmedArticle", [])
        return [self._parse_article(article) for article in articles]

    def _parse_article(self, article: dict) -> dict[str, str]:
        """Extract summary fields from one PubMed article.

        Args:
            article: Biopython PubMed article payload.
        Returns:
            Simplified citation dictionary.
        Agent:
            RAG
        """

        citation = article["MedlineCitation"]
        article_info = citation["Article"]
        abstract = " ".join(article_info.get("Abstract", {}).get("AbstractText", []))
        return {
            "pmid": str(citation["PMID"]),
            "title": str(article_info.get("ArticleTitle", "")),
            "year": str(article_info.get("Journal", {}).get("JournalIssue", {}).get("PubDate", {}).get("Year", "")),
            "abstract": abstract,
        }
