# ============================================
# AGENT: MainCompanionAgent
# ROLE: Maintain the Malayalam patient conversation with stable supportive tone
# TRIGGERS: Every patient turn after signal extraction and risk calculation
# OUTPUTS: CompanionReply dataclass for the patient-facing voice response
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

from contracts.agents import CompanionReply
from core.ai import GeminiClient, ThinkingLevel
from utils.logger import get_logger


class MainCompanionAgent:
    """Agent that crafts the patient-facing Malayalam reply."""

    def __init__(self) -> None:
        """Initialise the companion dependencies.

        Args:
            None: Uses the shared Gemini helper and logger.
        Returns:
            None.
        Agent:
            MainCompanionAgent
        """

        self.gemini = GeminiClient(thinking_level=ThinkingLevel.MINIMAL)
        self.logger = get_logger("sahayi.main_companion")

    async def respond(self, patient_profile: dict, session_history: list[str], patient_text: str) -> CompanionReply:
        """Generate a patient-facing Malayalam response.

        Args:
            patient_profile: Patient profile dictionary.
            session_history: Prior conversation turns for context.
            patient_text: Latest patient turn.
        Returns:
            Typed companion reply.
        Agent:
            MainCompanionAgent
        """

        self.logger.info("Main companion activated | patient_id=%s | trigger=patient_turn", patient_profile.get("id"))
        history = " | ".join(session_history[-6:])
        fallback = self._fallback_reply(patient_profile, patient_text)
        prompt = f"Patient profile: {patient_profile}\nConversation: {history}\nLatest: {patient_text}"
        # This API call sends the patient profile and session history, and expects a Malayalam conversational reply back.
        text = await self.gemini.ask_text(
            "You MUST reply ONLY in Malayalam script. Reply in warm Malayalam. Be observational, not diagnostic. Keep tone stable. Never use English.",
            prompt,
            fallback,
        )
        return CompanionReply(text=text, used_context=[patient_profile.get("name", ""), history, patient_text])

    def _fallback_reply(self, patient_profile: dict, patient_text: str) -> str:
        """Build a deterministic Malayalam fallback reply.

        Args:
            patient_profile: Patient profile dictionary.
            patient_text: Latest patient turn.
        Returns:
            Safe Malayalam fallback text.
        Agent:
            MainCompanionAgent
        """

        name = patient_profile.get("name", "സുഹൃത്തെ")
        if any(word in patient_text.lower() for word in ["pain", "നെഞ്ച്", "breathless"]):
            return f"{name}, ഞാൻ കേട്ടു. ഇത് ശ്രദ്ധിക്കേണ്ട കാര്യമാകാം. ഞാൻ നിങ്ങളുടെ ഡോക്ടറിലേക്ക് ഈ വിവരങ്ങൾ പങ്കിടാം. ഇനി എന്താണ് നിങ്ങൾക്ക് കൂടുതൽ ബുദ്ധിമുട്ട്?"
        return f"{name}, ഞാൻ കേൾക്കുന്നു. നിങ്ങൾ പറഞ്ഞത് രേഖപ്പെടുത്തി. നിങ്ങളുടെ മരുന്നുകളോ ആരോഗ്യസ്ഥിതിയോ കുറിച്ച് ഇനി എന്തെങ്കിലും പങ്കിടാമോ?"
