"""Gemini helper client for SAHAYI agents with google-genai SDK."""

from __future__ import annotations

import json
from enum import Enum
from typing import Any

from google.genai import client as gemini_client
from google.genai import types

from core.config import get_settings


class ThinkingLevel(str, Enum):
    """Agent thinking levels for Gemini extended thinking config."""
    
    MINIMAL = "minimal"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# Default thinking levels per agent as per audit requirements
AGENT_THINKING_LEVELS = {
    "main_companion": ThinkingLevel.MINIMAL,
    "signal_extractor": ThinkingLevel.MINIMAL,
    "safety_agent": ThinkingLevel.LOW,
    "research_intelligence": ThinkingLevel.MEDIUM,
    "hypothesis_agent": ThinkingLevel.HIGH,
    "population_intelligence": ThinkingLevel.LOW,
}


class GeminiClient:
    """Async Gemini client using google-genai SDK.
    
    Supports both:
    - Direct API key mode (GOOGLE_GEMINI_API) - using AI Studio
    - Vertex AI mode (GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION)
    
    Args:
        thinking_level: Agent-specific thinking configuration.
    Returns:
        GeminiClient instance with Gemini configuration.
    Agent:
        Platform
    """

    def __init__(self, thinking_level: ThinkingLevel = ThinkingLevel.MINIMAL) -> None:
        """Initialise Gemini client.
        
        Args:
            thinking_level: Thinking config level (minimal/low/medium/high).
        Returns:
            None.
        Agent:
            Platform
        """
        settings = get_settings()
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.project = settings.google_cloud_project
        self.location = settings.google_cloud_location
        self.thinking_level = thinking_level
        
        # Initialize Google GenAI Client
        # Use Vertex AI if project and location are configured, otherwise use direct API key
        if self.project and self.location:
            # Vertex AI mode (Google Cloud)
            self.client = gemini_client.Client(
                vertexai=True,
                project=self.project,
                location=self.location,
            )
        else:
            # Direct API key mode (AI Studio)
            self.client = gemini_client.Client(api_key=self.api_key)

    async def ask_json(
        self, 
        system: str, 
        prompt: str, 
        fallback: dict[str, Any],
        thinking_level: ThinkingLevel | None = None
    ) -> dict[str, Any]:
        """Request JSON output from Gemini with thinking config and fallback.
        
        Args:
            system: System instruction string.
            prompt: User prompt string.
            fallback: Fallback payload when Gemini is unavailable.
            thinking_level: Override thinking level for this specific call.
        Returns:
            Parsed JSON response or fallback data.
        Agent:
            Platform
        """
        
        level = thinking_level or self.thinking_level
        text = await self._generate(system, prompt, "application/json", level)
        if not text:
            return fallback
        try:
            data = json.loads(text)
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                return data[0]
            if not isinstance(data, dict):
                return fallback
            return data
        except json.JSONDecodeError:
            return fallback

    async def ask_text(
        self, 
        system: str, 
        prompt: str, 
        fallback: str,
        thinking_level: ThinkingLevel | None = None
    ) -> str:
        """Request free-form text output from Gemini with thinking config.
        
        Args:
            system: System instruction string.
            prompt: User prompt string.
            fallback: Fallback text when Gemini is unavailable.
            thinking_level: Override thinking level for this specific call.
        Returns:
            Model text output or fallback text.
        Agent:
            Platform
        """
        
        level = thinking_level or self.thinking_level
        text = await self._generate(system, prompt, "text/plain", level)
        return text.strip() if text else fallback

    async def _generate(
        self, 
        system: str, 
        prompt: str, 
        mime_type: str,
        thinking_level: ThinkingLevel
    ) -> str:
        """Call Gemini generateContent with thinking config.
        
        Args:
            system: System instruction string.
            prompt: User prompt string.
            mime_type: Expected response MIME type.
            thinking_level: Thinking configuration level.
        Returns:
            Generated text payload or an empty string.
        Agent:
            Platform
        """
        
        if not self.api_key:
            return ""
        
        try:
            # Build thinking config based on level
            thinking_config = None
            if self.model == "gemini-3-flash-preview":
                # Extended thinking budget for higher reasoning
                if thinking_level == ThinkingLevel.HIGH:
                    thinking_config = types.ThinkingConfig(thinking_budget=1024)
                elif thinking_level == ThinkingLevel.MEDIUM:
                    thinking_config = types.ThinkingConfig(thinking_budget=512)
            
            # Prepare contents
            user_content = types.Content(
                role="user",
                parts=[types.Part(text=prompt)]
            )
            
            system_instruction = types.Content(
                role="system",
                parts=[types.Part(text=system)]
            )
            
            # Generate config
            generate_content_config = types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type=mime_type,
                system_instruction=system_instruction,
                thinking_config=thinking_config,
            )
            
            # Call the model - use aio for async
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=[user_content],
                config=generate_content_config,
            )
            
            return self._extract_text(response)
        except Exception:
            return ""

    def _extract_text(self, response: Any) -> str:
        """Extract the first generated text part from a Gemini response.
        
        Args:
            response: Gemini client response object.
        Returns:
            Generated text string or an empty string.
        Agent:
            Platform
        """
        
        try:
            if not hasattr(response, 'candidates') or not response.candidates:
                return ""
            parts = response.candidates[0].content.parts
            return "".join(str(part.text) for part in parts)
        except Exception:
            return ""
