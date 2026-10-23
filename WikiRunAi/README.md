# WikiRun AI

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.104+-0097F7.svg" alt="FastAPI">
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/WebSocket-Support-orange.svg" alt="WebSocket">
  <img src="https://img.shields.io/badge/MongoDB-Stored-F47F24.svg" alt="MongoDB">
</p>

> Watch an AI navigate Wikipedia in real-time, finding paths between any two topics using intelligent link analysis and semantic search.

WikiRun AI is an AI-powered Wikipedia explorer that uses Large Language Models and embedding-based similarity search to navigate from one Wikipedia article to another through interconnected links. The AI analyzes page content, link structures, and semantic relationships to find the optimal path between topics.

![WikiRun AI Demo](https://via.placeholder.com/800x400?text=WikiRun+AI+Demo)

## Features

### 🤖 Intelligent Navigation
- **LLM-Powered Decision Making**: Uses Groq's Llama 3.3 model to intelligently select the best next link based on semantic understanding of the target topic
- **Smart Fallback**: When the LLM is unavailable, leverages embedding-based similarity search (BGE-small) combined with TF-IDF for reliable pathfinding
- **Real-Time Visualization**: Watch the AI navigate in real-time with an interactive graph visualization

### ⚡ Performance Optimized
- **Multi-Level Caching**: LRU memory cache + MongoDB persistent storage with automatic TTL expiration
- **Intelligent Prefetching**: Preloads likely next pages to minimize wait times
- **Async HTTP**: Non-blocking Wikipedia API calls with retry logic and rate limiting
- **Connection Pooling**: Optimized HTTP/2 connection management

### 🔍 Hybrid Search Engine
- **Semantic Embeddings**: Uses BGE-small-v1.5 for high-quality semantic similarity
- **TF-IDF Lexical Matching**: Character n-gram based matching as a secondary ranking signal
- **Category-Aware Ranking**: Automatically detects topic categories for smarter recommendations

### 💾 Persistent Storage
- **MongoDB Integration**: Caches Wikipedia pages and completed runs for instant replay
- **Configurable TTL**: Automatic cleanup of cached data after 14 days (configurable)

### 🔌 Real-Time Communication
- **WebSocket Support**: Live progress updates, node discoveries, and status messages
- **REST API**: Full HTTP API for integration and testing

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | FastAPI, Python 3.10+ |
| **Web Server** | Uvicorn |
| **Real-Time** | WebSockets |
| **Database** | MongoDB |
| **LLM** | Groq (Llama 3.3), Moonshot API |
| **Embeddings** | FastEmbed (BGE-small-en-v1.5), HuggingFace Inference API |
| **ML/IR** | scikit-learn (TF-IDF, Cosine Similarity), NumPy |
| **HTTP Client** | httpx |
| **Frontend** | HTML5, CSS3, JavaScript, vis-network |

## Installation

### Prerequisites

- Python 3.10 or higher
- MongoDB (optional, for caching)
- API keys (optional, for full functionality)

### 1. Clone the Repository

```bash
git clone https://github.com/ChristopherJoshy/WikiRunAi.git
cd WikiRunAi
```

### 2. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Environment Configuration

Create a `.env` file in the `backend` directory:

```bash
# LLM Configuration (Groq - Recommended)
MOONSHOT_API_KEY=your_groq_api_key_here

# OR use Moonshot API
# MOONSHOT_API_KEY=your_moonshot_api_key_here
# MOONSHOT_API_BASE_URL=https://api.moonshot.cn/v1

# MongoDB (Optional - enables caching)
MONGODB_URI=mongodb://localhost:27017/wikirun_ai

# Embedding Configuration (Optional)
HF_API_KEY=your_huggingface_api_key_here
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
ENABLE_EMBEDDING_FALLBACK=true
```

### 5. Run the Server

```bash
# Development
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

### 6. Open the Frontend

Navigate to `frontend/index.html` in your browser, or serve it:

```bash
# Using Python's built-in server
cd frontend
python -m http.server 3000
```

Then open `http://localhost:3000`

## Configuration

All configuration is done via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MOONSHOT_API_KEY` | - | API key for Groq or Moonshot |
| `GROQ_API_KEY` | - | Alternative Groq API key |
| `MOONSHOT_API_BASE_URL` | `https://api.groq.com/openai/v1` | LLM API endpoint |
| `MONGODB_URI` | - | MongoDB connection string |
| `HF_API_KEY` | - | HuggingFace API key for embeddings |
| `HUGGINGFACE_API_KEY` | - | Alternative HF API key |
| `HF_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` | Embedding model |
| `ENABLE_EMBEDDING_FALLBACK` | `false` | Enable embedding search without LLM |

### Runtime Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_STEPS` | 50 | Maximum navigation steps |
| `LLM_TEMP` | 0.6 | LLM temperature |
| `LLM_TOKENS` | 1024 | Max tokens for LLM response |
| `CACHE_DAYS` | 14 | Days before cache expires |

## Usage

### Web Interface

1. Enter a **Start Topic** (e.g., "Albert Einstein")
2. Enter a **Target Topic** (e.g., "Pizza")
3. Adjust **Max Steps** if needed
4. Toggle **AI Mode** for LLM-powered navigation
5. Click **Start Run**
6. Watch the AI navigate Wikipedia in real-time!

### API Endpoints

#### WebSocket - Start a Run

```
ws://localhost:8000/ws/run
```

**Request:**
```json
{
  "start_topic": "Albert Einstein",
  "target_topic": "Pizza",
  "max_steps": 50,
  "use_api": true
}
```

**Events:**

| Event | Description |
|-------|-------------|
| `status` | Current status message |
| `node` | New page discovered |
| `move` | AI moved to next page |
| `complete` | Run finished (success or failed) |
| `error` | Error occurred |
| `cancelled` | Run was cancelled |

#### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API root |
| GET | `/health` | Health check |
| GET | `/api/status` | Service status |
| GET | `/api/test-wiki` | Test Wikipedia API |
| POST | `/api/cancel/{run_id}` | Cancel a running session |

### Example: Programmatic Usage

```python
import asyncio
import httpx
import json

async def run_wikirun():
    async with httpx.AsyncClient() as client:
        # Test connection
        resp = await client.get("http://localhost:8000/health")
        print(await resp.json())
        
        # Check status
        resp = await client.get("http://localhost:8000/api/status")
        status = await resp.json()
        print(f"LLM: {status['model']}, Embeddings: {status['embedding_model']}")

asyncio.run(run_wikirun())
```

## API Response Examples

### Status Response

```json
{
  "status": "running",
  "has_api_key": true,
  "has_hf_key": false,
  "has_cache": true,
  "memory_cache": 42,
  "embedding_cache": 128,
  "active_runs": 0,
  "model": "llama-3.3-70b-versatile",
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "embedding_fallback_enabled": true
}
```

### Node Event

```json
{
  "type": "node",
  "node": {
    "step": 1,
    "title": "Albert Einstein",
    "url": "https://en.wikipedia.org/wiki/Albert_Einstein",
    "snippet": "Albert Einstein was a German-born theoretical physicist...",
    "thumbnail": "https://upload.wikimedia.org/..."
  },
  "path": [...],
  "visited_count": 1,
  "from_cache": false
}
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  WebSocket  │────▶│   Backend   │
│  (Browser)  │     │  Connection │     │  (FastAPI)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                     ┌──────────────────────────┼──────────────────────────┐
                     │                          │                          │
                     ▼                          ▼                          ▼
            ┌─────────────┐            ┌─────────────┐            ┌─────────────┐
            │  MongoDB    │            │  Wikipedia  │            │   LLM API   │
            │  Cache      │            │    API      │            │  (Groq)     │
            └─────────────┘            └─────────────┘            └─────────────┘
                                                                     
                                                                              ▼
                                                                   ┌─────────────────┐
                                                                   │   Embedding     │
                                                                   │   Service       │
                                                                   │ (HuggingFace)   │
                                                                   └─────────────────┘
```

## Troubleshooting

### No API Key
Without an API key, the system uses embedding-based fallback mode. It will still work but may be slower and less accurate.

### MongoDB Connection Failed
The application will run without MongoDB caching. Pages will only be cached in memory.

### Rate Limiting
If you encounter rate limits, the application automatically retries with exponential backoff.

### Embedding Errors
If embedding service is unavailable, falls back to pure TF-IDF lexical matching.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

Built with ❤️ by [Chris](https://github.com/christopherjoshy)

### Acknowledgments

- [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) - For providing free access to Wikipedia content
- [Groq](https://groq.com/) - For fast LLM inference
- [FastEmbed](https://github.com/qdrant/fastembed) - For efficient embedding generation
- [vis-network](https://visjs.org/) - For beautiful graph visualizations
- [FastAPI](https://fastapi.tiangolo.com/) - For the amazing web framework

---

<p align="center">
  ⭐ Star us on <a href="https://github.com/ChristopherJoshy/WikiRunAi">GitHub</a> if you found this interesting!
</p>
