# Backend Edit Request #5 — Fix Voice Call Keepalive Timeout

**Date:** 2026-03-15
**Author:** Christopher Joshy

## Problem
Voice calls drop abruptly with `ConnectionClosedError: keepalive ping timeout` because the WebSocket receive loop blocks during STT → orchestrator → TTS processing (5–15s). No pong frames are sent during this window, so Twilio kills the connection.

## Changes

### `voice/twilio_handler.py`
- Split `handle_stream_message` into `handle_stream_event` (non-blocking, returns instantly) and `process_audio_turn` (heavy pipeline, designed for background tasks).
- Added `_accumulate_audio` (sync, fast) and `_build_media_payload` helper.
- Added `mark` event handling to track when Twilio finishes playing audio.

### `api/routes_voice.py`
- Rewrote `voice_stream` to use:
  - A **send queue** (`asyncio.Queue`) + sender coroutine for outbound media events.
  - **Background tasks** (`asyncio.create_task`) for the heavy audio processing pipeline.
  - Proper **cleanup** in `finally` block (cancel tasks, run `_on_stop`).
- The receive loop now never blocks, allowing WebSocket keepalive pings to be handled by the framework.
