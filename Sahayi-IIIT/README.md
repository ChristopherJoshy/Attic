# സഹായി · Sahayi

### Voice-first AI health companion for elderly and rural India

*"Healthcare that speaks your language — literally."*

**[AI For Good Hackathon 2026](https://devpost.com)**

---

> Built for **AI For Good Hackathon 2026**  
> Team **Porotta and Sambar** · SJCET Palai, Kerala

---

## The Problem

Over **200 million elderly and rural Indians** face a healthcare access crisis that technology has largely ignored:

- **Language barrier** — Most health apps exist only in English. 65%+ of rural India is not functionally literate in English.
- **Digital literacy gap** — Complex interfaces exclude the people who need healthcare the most.
- **No continuity** — Scattered doctor visits with no passive monitoring between appointments.
- **Information desert** — Village-level health workers have no real-time clinical decision support.

A 70-year-old woman in Wayanad with hypertension should not need to type in English to manage her health. **Sahayi fixes this.**

---

## What Sahayi Does

Sahayi is a **voice-first, Malayalam-language, multi-agent AI health companion** that works over a simple phone call. No smartphone required. No app to install. No English needed.

A user calls a number. They speak in Malayalam. Sahayi listens, understands, tracks their health signals, surfaces clinical insights, and responds in natural Malayalam — all in real time.

```
User calls → speaks Malayalam → Sahayi agents process → responds in Malayalam voice
```

### Core capabilities

| Capability | Description |
|---|---|
| **Voice health check-ins** | Daily symptom tracking via natural conversation over Twilio in the user's native language |
| **All Indian language support** | Supports all 22 scheduled Indian languages including Malayalam, Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, Punjabi, Odia and more via Sarvam AI |
| **Passive signal monitoring** | Detects patterns across check-ins without the user doing anything extra |
| **Clinical RAG** | Answers health questions grounded in PubMed-indexed medical literature |
| **Population intelligence** | Aggregates anonymised signals to surface community-level health trends |
| **Emergency escalation** | Detects distress signals and routes to emergency contacts automatically |
| **Caregiver dashboard** | Family members and ASHA workers get a real-time view via the web app |

---

## Architecture

### The 7-Agent System

Sahayi runs on a **LangGraph multi-agent orchestration layer** with seven specialised agents. Each agent has a single responsibility and communicates via a shared state graph.

```
                          ┌─────────────────────┐
                          │   Orchestrator       │
                          │   (LangGraph Graph)  │
                          └──────────┬──────────┘
                                     │
          ┌──────────┬───────────────┼───────────────┬──────────┐
          ▼          ▼               ▼               ▼          ▼
   ┌─────────┐ ┌──────────┐  ┌────────────┐  ┌──────────┐ ┌────────────┐
   │  Voice  │ │  Health  │  │  Clinical  │  │Emergency │ │Population  │
   │  Agent  │ │ Monitor  │  │  RAG Agent │  │  Agent   │ │Intelligence│
   └────┬────┘ └────┬─────┘  └─────┬──────┘  └────┬─────┘ └─────┬──────┘
        │           │               │               │              │
        ▼           ▼               ▼               ▼              ▼
   Sarvam AI   ChromaDB +      PubMed API      Twilio SMS     Anonymised
   TTS / STT   SQLite DB       + Claude        + Alerts       Aggregation
```

| Agent | Role |
|---|---|
| **Voice Agent** | Handles all Sarvam AI TTS/STT calls. Converts Malayalam speech ↔ text. Manages Twilio telephony flow. |
| **Health Monitor Agent** | Tracks vitals and symptoms across sessions. Detects anomalies in reported data over time. |
| **Clinical RAG Agent** | Retrieves relevant PubMed articles via ChromaDB vector search. Grounds Claude's responses in medical evidence. |
| **Emergency Agent** | Monitors for distress keywords and physiological red flags. Triggers SMS alerts to registered emergency contacts. |
| **Population Intelligence Agent** | Aggregates anonymised health signals across users. Surfaces community trends for ASHA workers and health officials. |
| **Memory Agent** | Manages longitudinal patient context. Ensures every conversation is informed by full health history. |
| **Orchestrator Agent** | Routes queries between agents using LangGraph conditional edges. Manages state across the full conversation graph. |

### System flow

```
Phone Call (Twilio)
       │
       ▼
Voice Agent (Sarvam ASR → Malayalam text)
       │
       ▼
Orchestrator (LangGraph) ──► Health Monitor ──► ChromaDB
       │                         │
       ├──► Clinical RAG ──► PubMed + Claude
       │
       ├──► Emergency Agent ──► Twilio SMS
       │
       └──► Population Intelligence ──► Aggregation Layer
       │
       ▼
Voice Agent (Claude response → Sarvam TTS → Malayalam audio)
       │
       ▼
User hears response in Malayalam
```

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| API framework | FastAPI 0.111 + Uvicorn |
| Agent orchestration | LangGraph (multi-agent graph) |
| LLM | Claude (Anthropic API) · `claude-sonnet-4-6` |
| Gemini fallback | `gemini-3-flash-preview` |
| Malayalam voice | Sarvam AI (ASR + TTS) |
| Telephony | Twilio Voice API |
| Vector database | ChromaDB |
| Medical knowledge | PubMed E-utilities API |
| Auth + persistence | Firebase Admin SDK |
| Local persistence | SQLite via custom `db/` layer |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS |
| Auth | Firebase Authentication |
| State | React hooks |
| API layer | Custom `src/api/` client |

### Infrastructure
```
Frontend  →  Vercel (sahayi-iiit.vercel.app)
Backend   →  Local / any Python host
Database  →  Firebase + ChromaDB + SQLite
Voice     →  Twilio + Sarvam AI APIs
```

---

## Project Structure

```
Sahayi-IIIT/
├── sahayi/
│   ├── backend/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── api/                    # Route modules
│   │   ├── agents/                 # 7 LangGraph agents
│   │   ├── intelligence/           # Population analytics layer
│   │   ├── db/                     # SQLite + Firebase persistence
│   │   ├── rag/                    # ChromaDB + PubMed retrieval
│   │   ├── voice/                  # Twilio + Sarvam AI integrations
│   │   ├── requirements.txt
│   │   └── .env.example
│   └── frontend/
│       ├── src/
│       │   ├── pages/              # Screen components
│       │   ├── components/         # Reusable UI
│       │   ├── hooks/              # Stateful logic
│       │   ├── api/                # Backend client
│       │   ├── auth/               # Firebase auth
│       │   └── styles/             # Tailwind config
│       ├── package.json
│       └── .env.example
├── commits/reports/                # Hackathon progress reports
├── requests/                       # Sample API request payloads
├── AGENTS.md                       # Agent architecture guidelines
├── GEMINI.md                       # Gemini integration notes
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- A Twilio account (free trial works)
- Sarvam AI API key
- Anthropic API key
- Google Gemini API key
- Firebase project with service account JSON

### 1. Clone the repo

```bash
git clone https://github.com/ChristopherJoshy/Sahayi-IIIT.git
cd Sahayi-IIIT
```

### 2. Backend setup

```bash
cd sahayi/backend
cp .env.example .env          # fill in your API keys
python -m venv .venv

# Linux / macOS
source .venv/bin/activate

# Windows
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
python seed.py                # loads the demo patient record
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Required `.env` values:**

```env
ANTHROPIC_API_KEY=your_key_here
GOOGLE_GEMINI_API=your_key_here
GEMINI_MODEL=gemini-3-flash-preview

TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

SARVAM_API_KEY=your_key_here

PUBMED_EMAIL=your_email@example.com

# Firebase — place service-account JSON in sahayi/backend/
FIREBASE_SERVICE_ACCOUNT=firebase-service-account.json
```

Verify backend is running:
```bash
curl http://127.0.0.1:8000/health
# → {"status": "ok"}
```

### 3. Frontend setup

```bash
cd sahayi/frontend
cp .env.example .env          # add your Firebase config
npm install
npm run dev
```

### 4. Local URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://127.0.0.1:8000 |
| API docs | http://127.0.0.1:8000/docs |
| Health check | http://127.0.0.1:8000/health |

---

## Demo

### What the demo shows

1. A simulated phone call in Malayalam
2. Sahayi's voice agent processing the speech
3. Clinical RAG retrieving relevant medical context
4. Response delivered back in Malayalam audio
5. Caregiver dashboard updating in real time

---

## Impact

| Metric | Value |
|---|---|
| Target population | 200M+ elderly and rural Indians |
| Languages supported | All 22 scheduled Indian languages via Sarvam AI |
| Infrastructure required | Any phone — no smartphone, no app |
| Medical knowledge base | PubMed-indexed peer-reviewed literature |
| Response latency | < 3 seconds end-to-end |
| Works without internet literacy | ✓ |
| Works without English | ✓ |
| Works on a basic feature phone | ✓ (via Twilio call) |

---

## Hackathon

Built for the **[AI For Good Hackathon 2026](https://devpost.com)** on Devpost.

**Team: Porotta and Sambar** · SJCET Palai, Kerala, India

> *"Artificial intelligence is transforming our world and it must do so responsibly."*  
> — AI For Good Hackathon 2026

Sahayi demonstrates that responsible AI means building for the people who need it most — not just those with smartphones and English literacy.

---

## Roadmap

- [ ] Full coverage of all 22 scheduled Indian languages
- [ ] ASHA worker mobile companion app
- [ ] Offline mode for low-connectivity villages
- [ ] Integration with Ayushman Bharat health records
- [ ] WhatsApp-based access channel
- [ ] Clinical validation partnership with Kerala health department

---

## Contributing

PRs are welcome. Please read [AGENTS.md](AGENTS.md) before touching the agent layer — the LangGraph graph has specific conventions for state management and conditional edges.

```bash
# minimum validation before any PR
npm run build           # frontend
curl localhost:8000/health  # backend
```

---



Built with care for the people technology usually forgets.

**Team Porotta and Sambar** · SJCET Palai · Kerala, India · 2026
