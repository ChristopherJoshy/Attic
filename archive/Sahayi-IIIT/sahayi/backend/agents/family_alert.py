# ============================================
# AGENT: FamilyAlertAgent
# ROLE: Send calm WhatsApp alerts to relatives when escalation criteria are met
# TRIGGERS: Doctor unacknowledged for 3 hours with red flag or explicit doctor action
# OUTPUTS: AlertDispatch dataclass for audit and UI feedback
# TEAM: Porottayum Beefum — Sahayi @ TECHASHY'26
# ============================================

from __future__ import annotations

import asyncio

from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from contracts.agents import AlertDispatch
from core.config import get_settings
from utils.logger import get_logger
from utils.validators import normalize_whatsapp


class FamilyAlertAgent:
    """Agent that sends calm WhatsApp family alerts."""

    def __init__(self) -> None:
        """Initialise the Twilio alerting dependencies.

        Args:
            None: Uses environment-backed Twilio credentials.
        Returns:
            None.
        Agent:
            FamilyAlertAgent
        """

        settings = get_settings()
        self.logger = get_logger("sahayi.family_alert")
        self.from_number = normalize_whatsapp(settings.twilio_whatsapp_number)
        self.client = Client(settings.twilio_account_sid, settings.twilio_auth_token) if settings.twilio_account_sid and settings.twilio_auth_token else None

    async def send(self, patient: dict, reason: str, doctor_trigger: bool = False, red_flag: bool = False) -> AlertDispatch:
        """Send a calm WhatsApp alert when escalation rules allow it.

        Args:
            patient: Patient profile dictionary.
            reason: Human-readable reason for the alert.
            doctor_trigger: Whether a doctor explicitly triggered the alert.
            red_flag: Whether the latest patient state contains a red flag.
        Returns:
            Typed alert dispatch result.
        Agent:
            FamilyAlertAgent
        """

        self.logger.info("Family alert activated | patient_id=%s | trigger=%s", patient.get("id"), "doctor" if doctor_trigger else "overdue")
        relatives = patient.get("relatives") or []
        relative_name = relatives[0].get("name") if relatives else "Family Member"
        message = f"Hello {relative_name}, Sahayi suggests checking in with {patient.get('name')} today. Reason: {reason}. Please contact their doctor if needed."
        if not (doctor_trigger or red_flag):
            return AlertDispatch(delivered=False, channel="whatsapp", message=message)
        if not self.client:
            return AlertDispatch(delivered=False, channel="whatsapp", message=message)
        to_number = None
        if relatives:
            to_number = normalize_whatsapp(relatives[0].get("whatsapp_number", "") or relatives[0].get("phone", ""))
        if not to_number:
            self.logger.warning("Family alert skipped due to missing relative WhatsApp number | patient_id=%s", patient.get("id"))
            return AlertDispatch(delivered=False, channel="whatsapp", message=message)
        # This API call sends a WhatsApp message body and expects Twilio to return a queued message resource.
        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.messages.create,
                    from_=self.from_number,
                    to=to_number,
                    body=message,
                ),
                timeout=5,
            )
            return AlertDispatch(delivered=True, channel="whatsapp", message=message)
        except (TwilioRestException, TimeoutError, ValueError) as exc:
            self.logger.exception("Family alert failed | patient_id=%s | to=%s", patient.get("id"), to_number)
            return AlertDispatch(delivered=False, channel="whatsapp", message=f"{message} Delivery failed: {exc}")
