# Backend Edit Request #6 — Orchestrator Performance & Voice UX Improvements

**Date:** 2026-03-15
**Author:** Christopher Joshy

## Problem
1. **Orchestrator Latency:** Sequential execution of multiple AI agents (signal extraction, companion, safety, risk routing, etc.) leads to high response times (8–12s).
2. **User Experience:** The voice AI starts STT too early if the user pauses briefly, or waits too long after a full sentence.
3. **Memory Safety:** The audio buffer could theoretically grow indefinitely if a session stays open without a "stop" event.

## Changes

### `agents/orchestrator.py`
- Parallelized the orchestrator pipeline using `asyncio.gather`:
  - Signal extraction and companion reply now run concurrently.
  - Safety review and risk routing now run concurrently.
  - Hypothesis and doctor summary generation run concurrently within the risk routing logic.
  - External research (PubMed) and population pattern fetching now run concurrently.
- Implemented **fire-and-forget** for risk routing:
  - The voice reply only waits for the signal, companion, and safety agents.
  - The heavy research, hypothesis, and doctor summary generation now run as a background task (`_background_risk_routing`).
  - This reduces the time-to-first-audio-frame significantly for the user.

### `voice/twilio_handler.py`
- Added **energy-based silence detection** using Root Mean Square (RMS) calculation (`_mulaw_rms_energy`).
- The AI now waits for a configurable trailing silence (default 0.8s) after speech is detected before triggering the STT/orchestrator pipeline.
- Added `_accumulate_audio` logic to cap the buffer at 160KB (~20s of audio) to prevent overflow and stay within Sarvam STT limits.
- Added `processing` flag management to prevent race conditions when spawning background tasks.
