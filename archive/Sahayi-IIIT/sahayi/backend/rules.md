# SAHAYI BACKEND — RULES
# Team: Porottayum Beefum | TECHASHY'26

## Architecture Rules
- Every agent lives in agents/ — one file per agent
- Agents never call each other directly — only via orchestrator
- All business logic lives in intelligence/ — not in agents
- All DB access goes through db/database.py — never direct
- All external API calls go through dedicated client files

## Agent Rules
- Every agent must be a Python class with async methods
- Every agent must log its activation with timestamp + trigger
- Every agent must return a typed dataclass — never raw dict
- Safety Agent must run before EVERY patient-facing response
- Orchestrator must log every routing decision to SQLite

## Voice Pipeline Rules
- STT/TTS calls must have 5 second timeout with graceful failure handling
- If STT confidence < 0.6, ask the patient to repeat instead of guessing
- All voice sessions must be assigned a session_id UUID
- No audio is ever stored — only transcribed text, then deleted

## Data Rules
- No patient data leaves the server unencrypted
- All summaries sent to doctors are observational — never diagnostic
- Risk scores must always include the formula breakdown
- All PubMed/RAG results must be cited in doctor summaries

## Comment Rules
- Every function: docstring with args + returns + agent ownership
- Every agent file: header block as specified in main prompt
- Every API route: comment explaining request + response shape
- Every intelligence formula: comment showing the math
