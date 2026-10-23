# Projects

A working collection of things I've built over the years — web apps, bots, mobile apps,
experiments and competition entries. Each folder is a self-contained project, kept roughly
as it was when I last worked on it.

Some projects need their own setup steps or have dependencies that have since moved on.
Where a project has a live deployment, it's linked in its section.

---

## Index

| Project | What it is | Stack |
|---|---|---|
| [Typelo](#typelo) | Competitive typing platform with ranked play and anti-cheat | React, TypeScript, FastAPI, Postgres |
| [Orix-App](#orix-app) | Campus ride coordination with route matching and group chat | FastAPI, MongoDB, Redis, Flutter |
| [Orito-The-Linux-Helper](#orito-the-linux-helper) | Multi-agent Linux assistant with a tool registry | TypeScript, Fastify, MongoDB, LangChain |
| [WikiRunAi](#wikirunai) | An AI that plays the Wikipedia race game | Python, FastAPI, WebSockets |
| [PROJECT-H.Y.D.R.A.](#project-hydra) | Satellite water-quality monitoring through NASA CMR | Python, Streamlit, rasterio |
| [Sahayi-IIIT](#sahayi-iiit) | Voice-first health companion for Malayalam speakers | FastAPI, Twilio, Sarvam, Gemini |
| [CiCaWa-HashITup](#cicawa-hashitup) | Circular-waste marketplace with AI waste classification | Next.js, FastAPI, Gemini |
| [Untangle](#untangle) | Shared-expense tracker with natural-language entry | Next.js, Prisma, Groq |
| [DevQuest](#devquest) | RPG-style portfolio with zones, XP and a store | React, TypeScript, Vite |
| [Portfolio-Termux](#portfolio-termux) | Portfolio built as a terminal emulator | React, Express, Firebase |
| [IEEE-CS-SIGHT-Web-Competition](#ieee-cs-sight-web-competition) | Society website for IEEE SB CEK | React, TypeScript, Vite |
| [Orix-Landing](#orix-landing) | Landing and waitlist page for Orix | HTML, Tailwind, JavaScript |
| [Kturedesigncomp](#kturedesigncomp) | Redesign concept for the KTU student portal | React, TypeScript, Vite |
| [Forkls](#forkls) | Marketing site for a drone/motor company | HTML, CSS, JavaScript |
| [Joshuacafe2](#joshuacafe2) | Single-file site for a container cafe | HTML, CSS, Leaflet |
| [joshcafe-3](#joshcafe-3) | Another pass at the PlanEat Restocafe site | HTML, CSS |
| [JoshCafeDesigntemplate](#joshcafedesigntemplate) | Design template for the PlanEat Restocafe site | HTML, CSS |
| [joshuaproject](#joshuaproject) | Product catalogue for Mount Enterprise | HTML, CSS, JavaScript |
| [KKNotesV2](#kknotesv2) | Notes and videos platform for coursework | React, Express, Firebase |
| [ChrisTheTrader](#christhetrader) | Binance testnet trading bot with Telegram control | Python, CCXT, pandas |
| [Polaris-Bot](#polaris-bot) | Discord snowball-combat RPG | Python, discord.py, SQLite |
| [Ktu-Notes-Telegram-Bot](#ktu-notes-telegram-bot) | Telegram bot for browsing and submitting notes | Python, aiogram, MongoDB |
| [Hando](#hando) | Webcam hand-gesture controller for a browser game | Python, MediaPipe, PyAutoGUI |
| [Anchor---PoC](#anchor-poc) | Phone GPS spoofing detection, desktop proof of concept | Python, standard library |
| [Nexus-wars-local-testing-tools-](#nexus-wars-local-testing-tools-) | Offline test harness for Nexus Wars bots | Python, standard library |
| [Orbit-Wars-2026-herustrics-model](#orbit-wars-2026-herustrics-model) | Heuristic Kaggle Orbit Wars agent | Python, NumPy |
| [The-2026-NeuroGolf-Championship](#the-2026-neurogolf-championship) | Kaggle NeuroGolf workspace and profiler | Python, ONNX |
| [claude-workflow-run-config-lab](#claude-workflow-run-config-lab) | GitHub Actions security experiment | GitHub Actions |

---

## Web applications

### DevQuest

An RPG-style portfolio: sections are "zones", visitors earn XP, and there's a store, an
audio system, a cursor trail and a GitHub stats widget.

- React + TypeScript + Vite + Tailwind/shadcn
- Thin Express server for the contact endpoint
- GitHub Actions workflow deploying to GitHub Pages

The Drizzle/Postgres schema is declared but the runtime still uses an in-memory store.

### Portfolio-Termux

A portfolio built as a terminal emulator, with an admin panel behind it.

- React + TypeScript + Express + Firebase + Drizzle
- Custom terminal-emulator hooks rather than a library

### IEEE-CS-SIGHT-Web-Competition

Society website built for the IEEE SB CEK website competition — home, about, execom,
activities, achievements and contact pages.

- React + TypeScript + Vite + Tailwind/shadcn
- Wouter routing, TanStack Query
- Thin Express server, deployed on Railway

### Orix-Landing

Static landing and waitlist page for the Orix ride-sharing project.

- HTML + Tailwind (CDN) + vanilla JavaScript
- Formspree form, small chatbot widget

### CiCaWa-HashITup

Circular-waste platform built at a hackathon: users photograph waste, get classification and
disposal advice, and can trade recyclables in a marketplace or donate them to NGOs.

- Next.js 14 + TypeScript frontend
- FastAPI backend with JWT auth and Socket.IO
- Gemini for waste classification, SQLite via SQLAlchemy

### Untangle

Shared-expense tracker for roommates and groups: group ledgers, per-person splits, a
minimal "settle up" pass, group chat, natural-language expense entry and receipt OCR.

- Next.js 16 + React 19 + TypeScript + Tailwind + shadcn/ui
- Prisma + SQLite
- Groq (llama-3.3-70b) for natural-language entry, socket.io mini-service for realtime
- Bun + Caddy, deployed on Vercel

### Kturedesigncomp

Redesign concept for the KTU student portal: dashboard, attendance, fees, exams and
certificates, plus an in-browser PDF generator and a command palette.

- React 19 + TypeScript + Vite + Tailwind
- framer-motion, react-router-dom, oxlint
- Mock data only — this is a front-end and design exercise

### Forkls

Marketing site for a drone/motor company, with 39 routes, frame-based animations and an
offline-capable single-file build.

- Vanilla HTML/CSS/JavaScript, anime.js
- Vite for preview, Python/Pillow script that assembles the single-file build

### Joshuacafe2

Single-file site for PlanEat Restocafe, a container cafe in Kerala.

- HTML + CSS + vanilla JS
- Leaflet with a dark theme for the map, Open Graph metadata, animated menu/gallery

### joshcafe-3

A later pass at the PlanEat Restocafe site: a single page for the menu, gallery and contact
details, built around the cafe's photography.

- HTML + CSS + vanilla JS
- Image-heavy layout, inline SVG logo

### JoshCafeDesigntemplate

The design template the Restocafe sites started from — one page with a hero, menu sections
and a gallery, meant to be filled in with a venue's own photos and copy.

- HTML + CSS + vanilla JS

### joshuaproject

A client-side product catalogue for Mount Enterprise, a housekeeping materials and office
stationery supplier in Ahmedabad. Products live in a JSON file, and the page handles
search, categories and product detail views without a backend.

- Vanilla HTML/CSS/JavaScript, no build step
- `products_db.json` as the catalogue source
- Includes an "Orito" assistant panel wired to Mistral
- Vercel configuration for static deploy

---

## Products and platforms

### Typelo

Competitive typing platform: ranked matchmaking, ELO ratings, quests, friends and a
server-side anti-cheat pass that looks at keystroke timing rather than trusting the client.

- React + TypeScript + Vite frontend, FastAPI backend
- Postgres, Redis (matchmaking queue and locks), WebSockets
- PWA with offline support, SEO comparison pages
- Live at [typelo.tech](https://www.typelo.tech/)

### KKNotesV2

Notes and videos platform for coursework: browse by semester and subject, search, an admin
panel with roles and stats, and a PWA with push notifications.

- React 18 + Vite + TypeScript + shadcn/Tailwind + React Query
- Express + TypeScript server, multer uploads
- Firebase Auth, Realtime Database and Storage

---

## AI and agents

### Orito-The-Linux-Helper

A Linux assistant built as a multi-agent system. An orchestrator breaks a request into
steps, routes each step to a specialist agent, and executes it against the local system
using a tool registry, a vector store and web search.

- TypeScript + Fastify + MongoDB + Firebase Auth + WebSockets
- OpenRouter and Gemini for models, Tavily for search, Pinecone/Qdrant for retrieval
- Tool registry covers manpages, package search and command-safety validation
- Tiered access plans and audit logging; backend only — no client in this copy

### WikiRunAi

An AI that plays the Wikipedia race game — it has to get from one article to another using
only links. Each hop is chosen by an LLM with embeddings, with a TF-IDF fallback when
embeddings aren't available, and the route streams live over WebSockets.

- Python + FastAPI + WebSockets
- MongoDB with TTL caching, LRU cache in front
- Groq / Moonshot models, FastEmbed, scikit-learn
- vis-network frontend renders the path as a graph

### PROJECT-H.Y.D.R.A.

Satellite water-quality monitoring. Pulls Harmonized Landsat-Sentinel imagery through
NASA's CMR API, caches tiles, masks clouds, computes a normalized band index per water
body, averages across time and classifies bloom severity.

- Python + Streamlit, rasterio, folium, SQLite
- NASA CMR/HLS and GIBS; pytest suite
- The index is a single-band normalized difference — not true NDCI, which needs a
  red-edge band

### Sahayi-IIIT

Voice-first health companion for elderly and rural users in Kerala. A phone call goes
through speech-to-text, a multi-agent backend extracts clinical signals, checks safety,
builds hypotheses, retrieves research and decides whether to escalate, then speaks the
reply back.

- Python + FastAPI + SQLAlchemy/SQLite + WebSockets
- Twilio Voice, Sarvam AI (ASR/TTS), Google Gemini
- ChromaDB + sentence-transformers for retrieval, PubMed E-utilities
- Ten agent classes under a hand-written orchestrator (not LangGraph)
- Firebase-authed React dashboard with an agent-timeline debug panel

### Anchor---PoC

Proof of concept for phone GPS spoofing detection: six independent physics consistency
checks feed a weighted score into a deterministic RAIM/FDE-derived state machine with
debouncing.

- Python 3.13, standard library only at runtime
- NOAA solar-position math validated against the London solstice almanac
- 61 tests, 96% statement coverage, ~0.7 s suite
- Synthetic sensor traces only — this is the desktop PoC, not the Android build

---

## Bots, scripts and experiments

### ChrisTheTrader

Binance testnet trading bot mixing RSI and Stochastic-RSI signals with an
Avellaneda-Stoikov market-making model, controlled over Telegram with a SQLite trade log.

- Python, CCXT, pandas/NumPy, python-telegram-bot

### Polaris-Bot

Discord snowball-combat RPG: 50 levels, weapons, an economy, gambling, leaderboards, and a
Gemini-powered "Santa" chat that degrades gracefully without an API key.

- Python, discord.py, aiosqlite, Google Gemini
- Single-file `bot.py`, ~2.4k lines

### Ktu-Notes-Telegram-Bot

Telegram bot for browsing and submitting academic notes, with admin moderation and MongoDB
storage that falls back to memory when no database is configured.

- Python, aiogram v3, MongoDB

### Hando

Webcam hand-gesture controller for Temple Run 2 in the browser — MediaPipe tracks the hand
and PyAutoGUI turns gestures into key presses.

- Python, OpenCV, MediaPipe, PyAutoGUI
- Single script

### Nexus-wars-local-testing-tools-

A local CLI harness for testing Nexus Wars bots offline: a deterministic 1v1 interpreter
with orbital mechanics and swept collision detection, three example bots, and a round-robin
tournament runner that exports replays.

- Python 3.10+, standard library only
- The engine is a copy of the one from the main game project

### Orbit-Wars-2026-herustrics-model

A heuristic-only Kaggle Orbit Wars agent: a single-file, ~6k-line deterministic agent with
tactical search and NumPy prediction, plus a contract test and a benchmark script.

- Python 3, NumPy
- This copy is source-only; the replay/artifact workspace from the original repo is not
  included (see `ARCHIVE-NOTE.md`)

### The-2026-NeuroGolf-Championship

A Kaggle NeuroGolf working repo: an ONNX bundle profiling tool, submission tracking, and a
set of process and evidence notes from the competition.

- Python, onnx/onnxruntime, pytest
- This copy is source-only; model bundles, datasets and submitted artifacts are not
  included (see `ARCHIVE-NOTE.md`)

### claude-workflow-run-config-lab

A small GitHub Actions security experiment: two workflows testing whether a PR-controlled
`.claude/settings.json` is picked up by `anthropics/claude-code-action` during a
`workflow_run` job.

- GitHub Actions YAML only

---

## Mobile

### Orix-App

Campus ride coordination. Riders post a route, the matcher scores pairings by route overlap
using Haversine geometry with a weighted rubric, forms groups and settles the split. Chat
runs over WebSockets, and a Telegram bot handles admin operations.

- Python + FastAPI backend, MongoDB, Redis, Firebase
- Flutter/Dart app for Android, iOS, web and desktop
- Six pytest files, including the matchmaking tests

---

## Running a project

Each folder has its own dependencies and its own README where one exists. The general shape
is the same across the repo:

```bash
cd <project>
# read the folder's README first — setup differs per project
```

Python projects generally use a virtualenv and `pip install -r requirements.txt`.
JavaScript projects use `npm install` (or `bun install` where a `bun.lockb` is present).
A few need MongoDB, Redis, or API keys in a local `.env`; those keys are not included here.
Installed dependencies and build outputs (`node_modules/`, `dist/`, `build/`) are not
stored in this repo — run each project's install and build step to regenerate them.

---

## License

MIT — see [LICENSE](LICENSE).
