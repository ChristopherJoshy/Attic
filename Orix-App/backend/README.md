# ORIX Backend

FastAPI backend for the ORIX college ride coordination platform.

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── config.py            # Pydantic settings configuration
│   ├── database.py          # MongoDB and Redis connections
│   ├── dependencies.py      # FastAPI authentication dependencies
│   ├── models/              # Pydantic data models
│   ├── services/            # Business logic services
│   ├── routers/             # API endpoint routers
│   ├── middleware/          # Custom middleware (rate limiting)
│   ├── telegram_bot/        # Admin Telegram bot
│   └── workers/             # Background workers (matchmaking)
├── tests/                   # Pytest test suite
├── requirements.txt         # Python dependencies
└── .env.example             # Environment template
```

## Quick Start

### Prerequisites

- Python 3.10+
- MongoDB 6.0+
- Redis 7.0+
- Firebase project with Auth enabled

### Installation

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate

# Activate (Linux/macOS)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK credentials (JSON string) |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `ALLOWED_COLLEGE_DOMAINS` | Comma-separated list of allowed email domains |
| `ADMIN_API_SECRET` | Secret key for admin API access |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for admin notifications |

### Running the Server

```bash
# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Running the Matchmaking Worker

```bash
python -m app.workers.matchmaking_worker
```

### Running the Telegram Bot

```bash
python -m app.telegram_bot.bot
```

## API Documentation

Once running, OpenAPI docs are available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/verify` - Verify Firebase token
- `POST /api/v1/auth/onboard` - Complete user onboarding

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update profile
- `GET /api/v1/users/me/rider` - Get rider status
- `POST /api/v1/users/me/rider` - Enable rider mode
- `DELETE /api/v1/users/me/rider` - Disable rider mode

### Rides
- `POST /api/v1/rides` - Create ride request
- `DELETE /api/v1/rides/{request_id}` - Cancel ride request
- `GET /api/v1/rides/status` - Get matchmaking status
- `GET /api/v1/rides` - Get user's ride requests

### Groups
- `GET /api/v1/groups` - Get user's ride groups
- `GET /api/v1/groups/{group_id}` - Get group details
- `POST /api/v1/groups/{group_id}/confirm` - Confirm readiness
- `POST /api/v1/groups/{group_id}/chat` - Send chat message
- `GET /api/v1/groups/{group_id}/chat` - Get chat messages

### Reports
- `POST /api/v1/reports` - Create safety report

### Notifications
- `GET /api/v1/notifications` - Get notifications
- `PUT /api/v1/notifications/{id}/read` - Mark as read
- `PUT /api/v1/notifications/read-all` - Mark all as read

### Admin (requires X-Admin-Secret header)
- `GET /api/v1/admin/users/lookup` - Lookup user
- `POST /api/v1/admin/users/{id}/ban` - Ban user
- `POST /api/v1/admin/users/{id}/suspend` - Suspend user
- `POST /api/v1/admin/users/{id}/unban` - Unban user
- `GET /api/v1/admin/reports` - Get pending reports
- `POST /api/v1/admin/reports/{id}/resolve` - Resolve report
- `POST /api/v1/admin/maintenance` - Toggle maintenance mode
- `GET /api/v1/admin/stats` - Get system statistics

### WebSocket
- `WS /api/v1/ws?token=<firebase_token>` - Real-time updates

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_matchmaking.py -v
```

## Matchmaking Algorithm

The matchmaking service uses a multi-factor scoring algorithm:

1. **Route Overlap Score (40%)**: Uses Haversine distance to calculate pickup/drop proximity and direction similarity
2. **Time Compatibility Score (30%)**: Calculates overlap between time windows
3. **Trust Score (20%)**: User's historical trust rating
4. **Additional Factors (10%)**: Rider availability, preferences

Groups are formed when:
- 2+ users have combined score above threshold (0.6)
- All constraints satisfied (female-only, rider match)
- Confirmation received within timeout (configurable, default 5 min)

## Security Features

- **Firebase Auth**: Server-side token verification
- **College Domain Validation**: Only allowed email domains can register
- **Rate Limiting**: Sliding window algorithm (60 req/min default)
- **Audit Logging**: All admin and significant user actions logged
- **Phone Masking**: Numbers hidden until group confirmation

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show available commands |
| `/lookup <email\|id>` | Look up user details |
| `/ban <email\|id> <reason>` | Permanently ban user |
| `/suspend <email\|id> <hours> <reason>` | Temporarily suspend |
| `/unban <email\|id>` | Remove ban/suspension |
| `/reports` | View pending reports |
| `/resolve <id> <action> [note]` | Resolve a report |
| `/groups` | View active groups |
| `/cancel_group <id> <reason>` | Cancel a group |
| `/maintenance <on\|off>` | Toggle maintenance mode |
| `/stats` | View system statistics |

## License

Proprietary - ORIX Team
