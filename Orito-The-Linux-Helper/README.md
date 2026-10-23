# Orito - The Linux Helper

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white" alt="Fastify" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=white" alt="Firebase" />
</p>

<p align="center">
  <a href="https://github.com/orito-linux/helper/stargazers">
    <img src="https://img.shields.io/github/stars/orito-linux/helper?style=social" alt="GitHub Stars" />
  </a>
  <a href="https://github.com/orito-linux/helper/issues">
    <img src="https://img.shields.io/github/issues/orito-linux/helper" alt="GitHub Issues" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" />
  </a>
</p>

---

## Description

**Orito** is an AI-powered Linux assistant designed to help users with system administration, troubleshooting, and learning Linux. It combines large language models with a sophisticated multi-agent architecture to provide accurate, context-aware assistance tailored to the user's specific Linux distribution and environment.

Orito can:
- Execute and explain Linux commands
- Troubleshoot system issues
- Assist with package management across multiple distros
- Provide step-by-step guides for complex tasks
- Analyze terminal screenshots for error diagnosis

---

## Features

### 🤖 AI-Powered Assistance
- **Multi-Model Support**: Integrates with OpenRouter and Google Gemini for flexible LLM options
- **Intelligent Model Selection**: Automatically selects the best model based on task complexity
- **Vision Capabilities**: Analyze screenshots and terminal outputs using Gemini

### 🧠 Multi-Agent System
- **Orchestrator**: Central coordinator that classifies queries and dispatches appropriate agents
- **Research Agent**: Gathers relevant information from web searches and documentation
- **Planner Agent**: Breaks down complex tasks into executable steps
- **Validator Agent**: Validates commands for safety before execution
- **Synthesizer Agent**: Compiles research and planning into coherent responses
- **Curious Agent**: Collects system profile information (distro, package manager, etc.)

### 🛠️ Tool Registry
| Tool | Description |
|------|-------------|
| `web_search` | Search the web for Linux information |
| `search_wikipedia` | Search Wikipedia for Linux concepts |
| `lookup_manpage` | Retrieve man page documentation |
| `search_packages` | Search packages across package managers |
| `calculate` | Perform mathematical calculations |
| `validate_command` | Validate Linux command safety |
| `get_dry_run_equivalent` | Get dry-run versions of package commands |
| `get_current_datetime` | Get current date and time |

### 🔐 Authentication & Security
- **Firebase Authentication**: Secure user authentication via Firebase Auth
- **JWT Session Management**: Stateless token-based authentication
- **Tier-Based Access Control**: Trial, Free, and Pro tiers with different limits
- **Command Validation**: Dangerous commands are flagged before execution
- **Audit Logging**: Complete audit trail of all operations

### 💾 Data Persistence
- **MongoDB Storage**: Chat history, user preferences, and session data
- **Vector Store**: Pinecone/Qdrant integration for RAG capabilities
- **Context Caching**: Efficient caching for improved performance

### 🌐 WebSocket Support
- Real-time streaming responses
- Interactive question/answer flows
- System profile collection

---

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **TypeScript** | Type-safe JavaScript |
| **Fastify** | High-performance web framework |
| **MongoDB** | Primary database |
| **Mongoose** | ODM for MongoDB |
| **Firebase Admin** | Authentication |
| **OpenRouter SDK** | LLM integration (OpenAI, Anthropic, etc.) |
| **Google Gemini** | Vision & text generation |
| **Pinecone/Qdrant** | Vector database for RAG |
| **SearXNG** | Self-hosted web search |
| **Pino** | Structured logging |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Frontend)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    WebSocket / REST API
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                         Fastify Server                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Auth      │  │   Chat      │  │   WebSocket Handler     │  │
│  │   Routes    │  │   Routes    │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      Orchestrator                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Query Classification Engine                  │   │
│  │  • Greeting/Info (simple)                                 │   │
│  │  • Linux Questions (moderate)                            │   │
│  │  • System Actions (complex)                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │  Research   │───▶│   Planner   │───▶│  Validator  │          │
│  │   Agent     │    │   Agent     │    │   Agent     │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                                       │               │
│         └───────────────────┬───────────────────┘               │
│                             ▼                                   │
│                      ┌─────────────┐                           │
│                      │  Synthesizer│                           │
│                      │   Agent     │                           │
│                      └─────────────┘                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     Tool Executor                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  web_search │ manpage │ package-search │ calculator │   │    │
│  │  command-validator │ wiki │ date-time                    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   LLM       │      │  MongoDB    │      │   Vector    │
│  (OpenRouter│      │  Database   │      │   Store     │
│   Gemini)   │      │             │      │(Pinecone/   │
└─────────────┘      └─────────────┘      │ Qdrant)     │
                                         └─────────────┘
```

---

## Installation

### Prerequisites

- **Node.js** 20.x or later
- **MongoDB** 4.4 or later
- **Docker** (for SearXNG self-hosting)

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/orito-linux/helper.git
cd Orito-The-Linux-Helper/backend

# Install dependencies
npm install
```

---

## Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Required
OPENROUTER_API_KEY=your_openrouter_api_key
MONGODB_URI=mongodb://localhost:27017/orito
JWT_SECRET=your_secure_jwt_secret_min_32_chars
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-credentials.json

# Optional - AI Providers
GEMINI_API_KEY=your_gemini_api_key

# Optional - Search (SearXNG)
SEARXNG_ENABLED=true
SEARXNG_URL=http://localhost:8080
SEARXNG_INSTANCE_TYPE=local  # or 'remote'
SEARXNG_AUTO_START=true
SEARXNG_PORT=8080

# Optional - Vector Store
VECTOR_PROVIDER=pinecone  # or 'qdrant'
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=orito-rag

# Optional - Cache
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300

# Server
PORT=3001
NODE_ENV=development  # or 'production'
CORS_ORIGIN=http://localhost:3000
```

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password, Google, etc.)
3. Download service account credentials to `firebase-credentials.json`
4. Set `FIREBASE_PROJECT_ID` in your `.env`

---

## Usage

### Development

```bash
# Start development server with hot reload
npm run dev

# Server runs on http://localhost:3001
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Testing

```bash
# Run tests
npm test
```

---

## API Documentation

### Authentication

#### POST `/api/v1/auth/firebase`
Authenticate with Firebase ID token.

```json
{
  "idToken": "firebase_id_token"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "tier": "free"
  }
}
```

---

### Chat

#### POST `/api/v1/chats`
Create a new chat session.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "chat_id",
  "title": "New Chat",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET `/api/v1/chats`
List user's chat history.

**Response:**
```json
{
  "chats": [
    {
      "id": "chat_id",
      "title": "Chat Title",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET `/api/v1/chats/:id`
Get chat messages.

#### DELETE `/api/v1/chats/:id`
Delete a chat.

---

### WebSocket

#### WS `/api/v1/chat`
Real-time chat streaming endpoint.

**Message Format (send):**
```json
{
  "type": "message",
  "chatId": "chat_id",
  "content": "How do I install Docker on Ubuntu?"
}
```

**Message Format (receive):**
```json
{
  "type": "message:chunk",
  "content": "To install Docker on Ubuntu...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

```json
{
  "type": "message:done",
  "citations": [...],
  "commands": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### Search

#### POST `/api/v1/search`
Perform web search.

**Body:**
```json
{
  "query": "install docker ubuntu 22.04",
  "type": "general"
}
```

---

### Preferences

#### GET `/api/v1/preferences`
Get user preferences.

#### PUT `/api/v1/preferences`
Update user preferences.

```json
{
  "defaultDistro": "Ubuntu",
  "defaultShell": "bash",
  "responseStyle": "detailed",
  "customInstructions": "Explain commands before executing"
}
```

---

### Usage

#### GET `/api/v1/usage`
Get user's usage statistics.

**Response:**
```json
{
  "requestsToday": 15,
  "requestsLimit": 1000,
  "searchesToday": 5,
  "searchesLimit": 100,
  "tokensUsed": 50000
}
```

---

### Admin

#### GET `/api/v1/admin/users`
List all users (admin only).

#### GET `/api/v1/admin/stats`
Get system statistics (admin only).

---

## Security

### Command Safety
- Dangerous commands (`rm -rf`, `mkfs`, etc.) are automatically blocked
- Destructive commands require explicit user confirmation
- Commands are validated against a blocklist before execution
- Dry-run equivalents are suggested where available

### Authentication
- All endpoints require authentication except public config
- JWT tokens expire after configurable duration
- Firebase ID tokens are verified on each login

### Rate Limiting
- 300 requests per minute per IP
- Tier-based limits on requests, searches, and concurrent agents

### Data Protection
- Environment variables for all secrets
- No sensitive data in logs
- Input validation on all endpoints

---

## Tier System

| Feature | Trial | Free | Pro |
|---------|-------|------|-----|
| Total Requests | 12 | Unlimited | Unlimited |
| Requests/min | 40 | 40 | Unlimited |
| Searches/min | 5 | 20 | Unlimited |
| Concurrent Agents | 2 | 2 | Unlimited |
| Image Analysis/day | 0 | 5 | Unlimited |
| Chat Persistence | No | Yes | Yes |

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Credits

### Core Team
- **Orito** - AI Assistant

### Technologies
- [Fastify](https://fastify.io/) - Web framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Firebase](https://firebase.google.com/) - Authentication
- [OpenRouter](https://openrouter.ai/) - AI models
- [Google Gemini](https://gemini.google.com/) - Vision & AI

### Open Source Libraries
See `package.json` for full dependency list.

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

<p align="center">
  Made with ❤️ for the Linux community
</p>
