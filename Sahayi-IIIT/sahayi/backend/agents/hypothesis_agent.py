# ============================================
# AGENT: HypothesisAgent
# ROLE: Generate one testable hypothesis from research and population signals
# TRIGGERS: Risk score above hypothesis threshold in the orchestrator
# OUTPUTS: HypothesisResult dataclass with confidence and next data needs
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

from contracts.agents import HypothesisResult, PopulationFinding, ResearchInsight
from core.ai import GeminiClient, ThinkingLevel
from utils.logger import get_logger


class HypothesisAgent:
    """Agent that produces one testable hypothesis."""

    def __init__(self) -> None:
        """Initialise the hypothesis agent dependencies.

        Args:
            None: Uses the shared Gemini helper and logger.
        Returns:
            None.
        Agent:
            HypothesisAgent
        """

        self.gemini = GeminiClient(thinking_level=ThinkingLevel.HIGH)
        self.logger = get_logger("sahayi.hypothesis_agent")

    async def generate(self, research: ResearchInsight, patterns: list[PopulationFinding]) -> HypothesisResult:
        """Generate one structured hypothesis.

        Args:
            research: Grounded research synthesis output.
            patterns: Population patterns for comparison.
        Returns:
            Typed hypothesis result.
        Agent:
            HypothesisAgent
        """

        self.logger.info("Hypothesis agent activated | trigger=hypothesis_threshold")
        fallback = self._fallback_hypothesis(research, patterns)
        prompt = f"Research insight: {research}\nPopulation patterns: {patterns}\nReturn JSON: statement, confidence, confirming_data, refuting_data"
        # This API call sends synthesized evidence and expects one structured JSON hypothesis back.
        result = await self.gemini.ask_json("Generate one testable observational hypothesis as JSON only.", prompt, fallback)
        return HypothesisResult(
            statement=str(result.get("statement", fallback["statement"])),
            confidence=str(result.get("confidence", fallback["confidence"])),
            confirming_data=[str(item) for item in result.get("confirming_data", fallback["confirming_data"])],
            refuting_data=[str(item) for item in result.get("refuting_data", fallback["refuting_data"])],
        )

    def _fallback_hypothesis(self, research: ResearchInsight, patterns: list[PopulationFinding]) -> dict:
        """Create a deterministic fallback hypothesis.

        Args:
            research: Grounded research synthesis output.
            patterns: Population patterns for comparison.
        Returns:
            JSON-like fallback hypothesis payload.
        Agent:
            HypothesisAgent
        """

        statement = "Reduced appetite with rising fatigue may reflect worsening medication adherence rather than a new diagnosis."
        confidence = "Medium" if patterns else "Low"
        return {"statement": statement, "confidence": confidence, "confirming_data": ["pill count trend", "caregiver intake log"], "refuting_data": ["stable adherence history", "unchanged appetite records"]}
