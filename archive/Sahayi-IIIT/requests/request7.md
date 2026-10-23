# Backend Edit Request #7 — CORS & Firebase Authentication Stabilization

**Date:** 2026-03-15
**Author:** Christopher Joshy (via Gemini CLI)

## Problem
1. **CORS Blocking:** The frontend at `http://localhost:5173` was unable to communicate with the backend via the `ngrok` URL due to a missing `Access-Control-Allow-Origin` header and incorrect `CORSMiddleware` configuration for wildcard origins with credentials.
2. **Firebase Auth Failure:** The backend was missing critical `FIREBASE_PROJECT_ID` and `SERVICE_ACCOUNT_FILE` settings, causing `verify_token` to throw a `RuntimeError`.
3. **Internal Server Error:** Uncaught exceptions in `verify_token` were stripping CORS headers from the response, leading to confusing browser errors.
4. **WebSocket Connectivity:** The `ngrok` URL in `TWILIO_WEBHOOK_BASE` was outdated, and missing Firebase configuration prevented authenticated WebSocket upgrades.

## Changes

### `.env`
- Added `FIREBASE_PROJECT_ID=orix-6c8b3`.
- Set `SERVICE_ACCOUNT_FILE=orix-6c8b3-firebase-adminsdk-fbsvc-2d7e8ab311.json`.
- Updated `TWILIO_WEBHOOK_BASE` to `https://ce5a-117-250-240-128.ngrok-free.app`.
- Set `FRONTEND_URL=*` to stabilize cross-origin development.

### `main.py`
- Refined `CORSMiddleware` setup to use `allow_origin_regex=".*"` for wildcard support when `allow_credentials=True`.

### `core/security.py`
- Added a `try-except` block to `verify_token` to catch initialization or verification errors.
- Now raises a proper `HTTPException` (401 Unauthorized) instead of letting a `RuntimeError` bubble up, ensuring CORS headers remain in the response.
