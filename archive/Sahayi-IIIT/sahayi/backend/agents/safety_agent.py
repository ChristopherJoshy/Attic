# ============================================
# AGENT: SafetyAgent
# ROLE: Review all patient-facing responses for unsafe or unsupported advice
# TRIGGERS: Every companion response before it is returned to the patient
# OUTPUTS: SafetyReview dataclass with safe fallback when needed
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

from contracts.agents import SafetyReview
from core.ai import GeminiClient, ThinkingLevel
from utils.logger import get_logger

SAFE_FALLBACK = (
    "I understand. For specific medical advice, please speak with your doctor. "
    "Is there anything else I can help you understand about your medicines?"
)


class SafetyAgent:
    """Agent that guards every patient-facing response."""

    def __init__(self) -> None:
        """Initialise the safety-review dependencies.

        Args:
            None: Uses the shared Gemini helper and logger.
        Returns:
            None.
        Agent:
            SafetyAgent
        """

        self.gemini = GeminiClient(thinking_level=ThinkingLevel.LOW)
        self.logger = get_logger("sahayi.safety_agent")

    async def review(self, response_text: str, rag_context: list[str]) -> SafetyReview:
        """Review a patient-facing reply and return a safe variant.

        Args:
            response_text: Proposed response text.
            rag_context: Context strings used to build the reply.
        Returns:
            Typed safety review result.
        Agent:
            SafetyAgent
        """

        self.logger.info("Safety agent activated | trigger=patient_response")
        fallback = self._heuristic_review(response_text)
        prompt = f"Check JSON: verdict, confidence, flagged_claims. Response: {response_text}. Evidence: {rag_context}"
        # This API call sends the candidate response and evidence context, and expects a JSON safety verdict back.
        result = await self.gemini.ask_json("Return strict JSON for medical safety review only.", prompt, fallback)
        verdict = str(result.get("verdict", fallback["verdict"])).upper()
        confidence = float(result.get("confidence", fallback["confidence"]))
        unsafe = verdict != "SAFE" or confidence < 0.7
        safe_response = SAFE_FALLBACK if unsafe else response_text
        flagged = [str(item) for item in result.get("flagged_claims", fallback["flagged_claims"])]
        return SafetyReview(verdict="UNSAFE" if unsafe else "SAFE", confidence=confidence, flagged_claims=flagged, safe_response=safe_response)

    def _heuristic_review(self, response_text: str) -> dict:
        """Apply a conservative local safety heuristic.

        Args:
            response_text: Proposed response text.
        Returns:
            Fallback JSON-like review payload.
        Agent:
            SafetyAgent
        """

        lowered = response_text.lower()
        risky = any(token in lowered for token in ["you have", "diagnosis", "stop taking", "definitely"])
        return {"verdict": "UNSAFE" if risky else "SAFE", "confidence": 0.55 if risky else 0.82, "flagged_claims": ["unsupported claim"] if risky else []}
