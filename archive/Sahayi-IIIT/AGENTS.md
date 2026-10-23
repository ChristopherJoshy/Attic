# Repository Guidelines

## Project Structure & Module Organization
`README.md` covers first-time setup. Application code lives under `sahayi/`. `sahayi/backend/` is the FastAPI service: `main.py` boots the app, `api/` holds route modules, `agents/` and `intelligence/` contain domain logic, `db/` manages persistence, `rag/` handles retrieval, and `voice/` contains telephony and audio integrations. `sahayi/frontend/` is a Vite + React app: `src/pages/` for screens, `src/components/` for reusable UI, `src/hooks/` for stateful logic, `src/api/` for backend calls, `src/auth/` for Firebase auth, and `src/styles/` for Tailwind-based styles.

## Build, Test, and Development Commands
Backend, from `sahayi/backend/`: `python -m venv .venv`, `.\.venv\Scripts\Activate.ps1`, `python -m pip install -r requirements.txt`, then `uvicorn main:app --reload --host 127.0.0.1 --port 8000`. Use `python seed.py` to load the demo patient record, and verify the service with `Invoke-WebRequest http://127.0.0.1:8000/health -UseBasicParsing`.

Frontend, from `sahayi/frontend/`: `npm install`, `npm run dev`, `npm run build`, and `npm run preview`. Use `npm run build` as the minimum pre-merge sanity check for UI changes.

## Coding Style & Naming Conventions
Python follows the existing FastAPI style: 4-space indentation, snake_case modules and functions, and type hints where practical. Keep routing, business logic, and database access separated by layer. React files use 2-space indentation, semicolons, double quotes, PascalCase component names such as `PatientCard.jsx`, and camelCase hooks such as `usePatientData.js`.

## Testing Guidelines
No automated test runner is checked in yet. Minimum validation is `npm run build` for the frontend plus the backend health check and manual exercise of affected flows. If you add automated coverage, place backend tests under `sahayi/backend/tests/` and keep frontend tests close to the feature they cover.

## Commit & Pull Request Guidelines
Recent commits use short imperative, sentence-case subjects such as `Fix backend entrypoint and add frontend index.html`. Keep commits focused and descriptive. PRs should explain user-facing impact, list config or schema changes, link the related issue, and include screenshots for dashboard or setup UI updates.

## Security & Configuration Tips
Do not commit `.env` files, Firebase service-account JSON, SQLite databases, virtual environments, `node_modules/`, or lockfiles currently ignored by the repo. Start from each app’s `.env.example` and keep real credentials local.
