# Report 1: Twilio Signature Fix and Patient Registration Number Enhancements

## Description
This report details the changes made to the backend to support patient registration numbers, improve the AI's first contact in Malayalam, and fix Twilio signature validation issues when running behind ngrok.

## Changes
### Twilio and Voice
- Fixed `403 Forbidden` issues by reconstructing the original HTTPS URL using proxy headers (`X-Forwarded-Proto`, `X-Forwarded-Host`).
- Added `SARVAM_TTS_SPEAKER` (defaulting to "ritu") to configuration.
- Synthesized and returned a Malayalam greeting ("ഹലോ {name}, ഞാൻ സഹായി ആണ്") as the first audio frame in voice calls.
- Updated voice and WhatsApp rejection messages to Malayalam.

### Patient Data Model
- Added `registration_number` field to the `Patient` SQLAlchemy model.
- Updated `PatientCreateRequest`, `PatientUpdateRequest`, and `PatientResponse` contracts to include `registration_number`.
- Implemented `get_patient_by_registration` and `get_patient_by_id` in the database gateway.

### AI and Extraction
- Refined `SignalExtractorAgent` prompt to ensure single JSON object extraction.
- Improved `GeminiClient.ask_json` to handle cases where JSON is wrapped in a list.

### Miscellaneous
- Enabled `proxy_headers` in `uvicorn.run` for correct request context behind proxies.
- Updated `seed.py` with a sample registration number.
