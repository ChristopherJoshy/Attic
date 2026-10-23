# ============================================
# AGENT: SignalExtractorAgent
# ROLE: Extract structured symptom signals from raw patient text
# TRIGGERS: Every patient turn received by the orchestrator
# OUTPUTS: ExtractedSignal dataclass persisted to SQLite
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

import re
from dataclasses import asdict

from contracts.agents import ExtractedSignal
from core.ai import GeminiClient, ThinkingLevel
from db.database import DatabaseGateway
from utils.logger import get_logger
from utils.validators import clamp_severity


class SignalExtractorAgent:
    """Agent that extracts symptom signals from patient text."""

    def __init__(self, database: DatabaseGateway) -> None:
        """Initialise the signal extractor dependencies.

        Args:
            database: Shared database gateway instance.
        Returns:
            None.
        Agent:
            SignalExtractorAgent
        """

        self.database = database
        self.gemini = GeminiClient(thinking_level=ThinkingLevel.MINIMAL)
        self.logger = get_logger("sahayi.signal_extractor")

    async def extract(self, patient_id: int, session_id: str, transcript: str) -> ExtractedSignal:
        """Extract and persist one structured signal record.

        Args:
            patient_id: Patient identifier.
            session_id: Active session UUID.
            transcript: Raw transcript text to parse.
        Returns:
            Persisted ExtractedSignal dataclass.
        Agent:
            SignalExtractorAgent
        """

        self.logger.info("Signal extractor activated | patient_id=%s | session_id=%s | trigger=patient_turn", patient_id, session_id)
        fallback = self._heuristic_extract(patient_id, session_id, transcript)
        prompt = f"Extract a single JSON object with these keys: fatigue (bool), appetite (string), chest_pain (bool), duration_days (int), severity (int 1-5), red_flag (bool), symptom_description (string - a human readable 1-2 sentence description of the symptoms identified, e.g. 'The patient is experiencing severe chest pain and fatigue'. Return an empty string \"\" if there are no medical symptoms mentioned), confidence (float 0-1). Transcript: {transcript}"
        # This API call sends raw transcript text and expects a structured JSON object back.
        result = await self.gemini.ask_json("You are a medical data extractor. Respond ONLY with a single JSON object. Do not use lists.", prompt, asdict(fallback))
        fatigue = result.get("fatigue") if result.get("fatigue") is not None else fallback.fatigue
        appetite = result.get("appetite") if result.get("appetite") is not None else fallback.appetite
        chest_pain = result.get("chest_pain") if result.get("chest_pain") is not None else fallback.chest_pain
        duration_days = result.get("duration_days") if result.get("duration_days") is not None else fallback.duration_days
        severity = result.get("severity") if result.get("severity") is not None else fallback.severity
        red_flag = result.get("red_flag") if result.get("red_flag") is not None else fallback.red_flag
        symptom_description = result.get("symptom_description") if result.get("symptom_description") is not None else fallback.symptom_description
        confidence = result.get("confidence") if result.get("confidence") is not None else fallback.confidence
        
        symptom_description_str = str(symptom_description)
        lower_desc = symptom_description_str.lower()
        if any(p in lower_desc for p in ["no symptom", "no medical", "closing statement"]):
            symptom_description_str = ""

        signal = ExtractedSignal(
            patient_id=patient_id,
            session_id=session_id,
            fatigue=bool(fatigue),
            appetite=str(appetite),
            chest_pain=bool(chest_pain),
            duration_days=max(0, int(duration_days)),
            severity=clamp_severity(int(severity)),
            red_flag=bool(red_flag),
            symptom_description=symptom_description_str,
            source_text=transcript,
            confidence=float(confidence),
        )
        await self.database.save_signal(asdict(signal))
        return signal

    def _heuristic_extract(self, patient_id: int, session_id: str, transcript: str) -> ExtractedSignal:
        """Fallback extraction when Gemini is unavailable.

        Args:
            patient_id: Patient identifier.
            session_id: Active session UUID.
            transcript: Raw transcript text to parse.
        Returns:
            Heuristically derived ExtractedSignal dataclass.
        Agent:
            SignalExtractorAgent
        """

        lowered = transcript.lower()
        duration = self._extract_days(lowered)
        chest_pain = any(token in lowered for token in ["chest pain", "നെഞ്ച്", "heart pain", "pressure"])
        fatigue = any(token in lowered for token in ["tired", "fatigue", "weak", "ക്ഷീണം"])
        appetite = "reduced" if any(token in lowered for token in ["no appetite", "appetite", "വിശപ്പ്", "eat less"]) else "unchanged"
        red_flag = chest_pain or any(token in lowered for token in ["breathless", "faint", "collapse", "dizzy"])
        severity = 5 if red_flag else 4 if "severe" in lowered else 2 if "mild" in lowered else 3
        
        symptoms = []
        if chest_pain: symptoms.append("chest pain")
        if fatigue: symptoms.append("fatigue")
        if appetite == "reduced": symptoms.append("reduced appetite")
        symptom_desc = f"The patient reported {', '.join(symptoms)}." if symptoms else "The patient reported no specific severe symptoms."
        
        return ExtractedSignal(patient_id, session_id, fatigue, appetite, chest_pain, duration, severity, red_flag, symptom_desc, transcript, 0.62)

    def _extract_days(self, transcript: str) -> int:
        """Extract duration in days from text.

        Args:
            transcript: Lower-cased transcript text.
        Returns:
            Integer day count.
        Agent:
            SignalExtractorAgent
        """

        match = re.search(r"(\d+)\s*(day|days|ദിവസം)", transcript)
        return int(match.group(1)) if match else 1
