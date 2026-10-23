# ============================================
# AGENT: ResearchIntelligenceAgent
# ROLE: Synthesize patient signals with RAG and PubMed evidence for clinicians
# TRIGGERS: Risk score above research threshold in the orchestrator
# OUTPUTS: ResearchInsight dataclass with citations and graph payload
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

import asyncio

from contracts.agents import ExtractedSignal, ResearchInsight
from core.ai import GeminiClient, ThinkingLevel
from rag.chroma_store import ChromaStore
from rag.pubmed_client import PubMedClient
from utils.logger import get_logger


class ResearchIntelligenceAgent:
    """Agent that synthesizes grounded research evidence."""

    def __init__(self, chroma_store: ChromaStore, pubmed_client: PubMedClient) -> None:
        """Initialise retrieval and synthesis dependencies.

        Args:
            chroma_store: Shared Chroma wrapper.
            pubmed_client: Shared PubMed client.
        Returns:
            None.
        Agent:
            ResearchIntelligenceAgent
        """

        self.chroma = chroma_store
        self.pubmed = pubmed_client
        self.gemini = GeminiClient(thinking_level=ThinkingLevel.MEDIUM)
        self.logger = get_logger("sahayi.research_intelligence")

    async def analyze(
        self,
        signal: ExtractedSignal,
        patient_history: list[dict],
        patient_profile: dict,
    ) -> ResearchInsight:
        """Build a clinician-facing research synthesis.

        Args:
            signal: Latest extracted signal.
            patient_history: Recent patient signal history.
            patient_profile: Patient profile dictionary.
        Returns:
            Typed research insight.
        Agent:
            ResearchIntelligenceAgent
        """

        self.logger.info(
            "Research intelligence activated | patient_id=%s | trigger=risk_threshold",
            signal.patient_id,
        )
        query = f"{patient_profile.get('conditions', [])} {signal.source_text} {signal.appetite}"
        rag_chunks = self.chroma.query(query, n_results=5)
        citations = await self.pubmed.search(query, max_results=3)
        prompt = f"Signal: {signal}\nHistory: {patient_history}\nRAG: {rag_chunks}\nPubMed: {citations}"
        # This API call sends patient signals plus retrieved evidence, and expects an observational English synthesis back.
        narrative_task = self.gemini.ask_text(
            "Write an observational English clinical insight with citations.",
            prompt,
            "Research insight could not be generated.",
        )
        graph_task = self._build_graph(signal, rag_chunks, citations)

        narrative, graph = await asyncio.gather(narrative_task, graph_task)

        return ResearchInsight(
            narrative=narrative, rag_chunks=rag_chunks, citations=citations, graph=graph
        )

    async def _build_graph(
        self, signal: ExtractedSignal, rag_chunks: list[dict], citations: list[dict]
    ) -> dict:
        """Create the dashboard knowledge-graph payload.

        Args:
            signal: Latest extracted signal.
            rag_chunks: Retrieved RAG chunks.
            citations: PubMed citations.
        Returns:
            D3-ready graph payload.
        Agent:
            ResearchIntelligenceAgent
        """

        prompt = f"""
        Given the following clinical data:
        Signal: {signal}
        RAG: {rag_chunks}
        PubMed: {citations}

        Generate a structured JSON response representing a knowledge graph.
        The JSON must contain two keys:
        1. "nodes": A list of objects, each with:
           - "id": A unique string identifier (e.g., "symptom-fatigue").
           - "label": A short, readable label (e.g., "Fatigue").
           - "type": One of "symptom", "condition", "evidence", or "recommendation".
        2. "edges": A list of objects, each with:
           - "source": The ID of the source node.
           - "target": The ID of the target node.
           - "weight": A float between 0.1 and 1.0 indicating connection strength.

        Return ONLY the JSON object.
        """

        fallback = {
            "nodes": [],
            "edges": [],
        }

        try:
            result = await self.gemini.ask_json(
                "Generate a clinical knowledge graph JSON.", prompt, fallback
            )
            result["version"] = len(rag_chunks) + len(citations)
            return result
        except Exception:
            fallback["version"] = len(rag_chunks) + len(citations)
            return fallback
