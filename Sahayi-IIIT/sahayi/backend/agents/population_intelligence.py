# ============================================
# AGENT: PopulationIntelligenceAgent
# ROLE: Detect population-level symptom patterns and research gaps
# TRIGGERS: APScheduler job every 6 hours
# OUTPUTS: PopulationFinding dataclasses persisted to SQLite
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import asdict
from datetime import datetime, timedelta

from contracts.agents import PopulationFinding
from db.database import DatabaseGateway
from rag.pubmed_client import PubMedClient
from utils.logger import get_logger


class PopulationIntelligenceAgent:
    """Agent that computes recurring population symptom patterns."""

    def __init__(self, database: DatabaseGateway, pubmed_client: PubMedClient) -> None:
        """Initialise the population intelligence dependencies.

        Args:
            database: Shared database gateway instance.
            pubmed_client: Shared PubMed client.
        Returns:
            None.
        Agent:
            PopulationIntelligenceAgent
        """

        self.database = database
        self.pubmed = pubmed_client
        self.logger = get_logger("sahayi.population_intelligence")

    async def run(self) -> list[PopulationFinding]:
        """Compute and persist the latest population patterns.

        Args:
            None: Pulls recent signals from SQLite.
        Returns:
            List of persisted population findings.
        Agent:
            PopulationIntelligenceAgent
        """

        self.logger.info("Population intelligence activated | trigger=scheduler")
        signals = await self.database.all_recent_signals(days=14)
        current_cutoff = datetime.utcnow() - timedelta(days=7)
        current = [item for item in signals if item.created_at >= current_cutoff]
        previous = [item for item in signals if item.created_at < current_cutoff]
        current_counts = Counter(self._pattern_key(item) for item in current)
        previous_counts = Counter(self._pattern_key(item) for item in previous)
        findings = [await self._save_pattern(key, count, previous_counts[key]) for key, count in current_counts.items()]
        return findings

    async def _save_pattern(self, key: str, frequency: int, previous_frequency: int) -> PopulationFinding:
        """Build and store one population pattern.

        Args:
            key: Encoded symptom-cluster key.
            frequency: Current-week cluster frequency.
            previous_frequency: Previous-week cluster frequency.
        Returns:
            Persisted population finding.
        Agent:
            PopulationIntelligenceAgent
        """

        papers = await self.pubmed.search(key, max_results=3)
        finding = PopulationFinding(
            pattern_json={"cluster": key.split("|")},
            frequency=frequency,
            week_delta=frequency - previous_frequency,
            research_gap=len(papers) < 3,
        )
        await self.database.save_population_pattern(asdict(finding))
        return finding

    def _pattern_key(self, record: object) -> str:
        """Encode a signal record into a cluster key.

        Args:
            record: SignalRecord ORM instance.
        Returns:
            Stable cluster key string.
        Agent:
            PopulationIntelligenceAgent
        """

        return getattr(record, "symptom_description", "") or "unspecified"
