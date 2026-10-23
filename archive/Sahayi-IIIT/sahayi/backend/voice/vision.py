"""Vision helpers for WhatsApp prescription extraction."""

from __future__ import annotations

import httpx
from dataclasses import asdict

from contracts.clinical import PrescriptionData
from core.config import get_settings
from utils.logger import get_logger


async def extract_prescription_from_url(image_url: str) -> PrescriptionData:
    """Extract structured prescription data from an image URL using Gemini Vision.
    
    Args:
        image_url: Public URL of the prescription image from Twilio.
    Returns:
        PrescriptionData with extracted medicines, doses, timings, purposes.
    Agent:
        WhatsApp Vision
    """
    
    logger = get_logger("sahayi.vision")
    settings = get_settings()
    
    prompt = """Extract the prescription details from this image. 
    Return ONLY a JSON object with these exact keys:
    - medicines: array of medicine names
    - doses: array of doses (e.g., "500mg", "10ml")  
    - timings: array of timings (e.g., "morning", "night", "after food", "before food")
    - purposes: array of purposes/indications for each medicine
    - raw_text: the full raw text visible in the prescription
    
    If no medicines found, return empty arrays."""
    
    try:
        # Download image first
        async with httpx.AsyncClient(timeout=30) as client:
            image_response = await client.get(image_url)
            image_response.raise_for_status()
            image_bytes = image_response.content
        
        # Use Gemini Vision via google-genai
        from google import genai
        from google.genai import types
        
        # Initialize client - works with both Vertex AI and direct API key
        if settings.google_cloud_project and settings.google_cloud_location:
            client = genai.Client(
                vertexai=True,
                project=settings.google_cloud_project,
                location=settings.google_cloud_location,
            )
        else:
            client = genai.Client(api_key=settings.gemini_api_key)
        
        # Create image part
        image_part = types.Part(
            inline_data=types.Blob(
                data=image_bytes,
                mime_type=image_response.headers.get("content-type", "image/jpeg")
            )
        )
        
        # Generate using google-genai SDK
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=[prompt, image_part],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
                system_instruction="You are a medical prescription parser. Extract structured data only."
            )
        )
        
        # Parse response
        text = response.candidates[0].content.parts[0].text
        import json
        data = json.loads(text)
        
        return PrescriptionData(
            medicines=data.get("medicines", []),
            doses=data.get("doses", []),
            timings=data.get("timings", []),
            purposes=data.get("purposes", []),
            raw_text=data.get("raw_text", ""),
            confidence=0.85
        )
        
    except Exception as e:
        logger.error("Vision extraction failed: %s", str(e))
        return PrescriptionData(
            medicines=[],
            doses=[],
            timings=[],
            purposes=[],
            raw_text="",
            confidence=0.0
        )
