# Orix-App

[![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?style=flat-square&logo=flutter)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.x-0175C2?style=flat-square&logo=dart)](https://dart.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.x-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat-square&logo=firebase)](https://firebase.google.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-434343?style=flat-square)](https://flutter.dev)

Orix is a comprehensive college ride coordination platform that connects students for safe and affordable rides. The app facilitates intelligent rider-driver matching using advanced algorithms, enables seamless group formation for shared commutes, and provides real-time chat functionality for convenient communication between riders and drivers. Built with Flutter for the frontend and FastAPI for the backend, Orix leverages Firebase Authentication to ensure only verified college students can access the platform.

## Features

### Intelligent Rider-Driver Matching

The platform uses a sophisticated multi-factor scoring algorithm to pair riders with compatible drivers. The system evaluates route overlap using Haversine distance calculations to measure pickup and drop-off proximity and direction similarity, contributing 40% to the overall match score. Time compatibility scoring calculates the overlap between user-specified time windows at 30% weight, ensuring riders and drivers have compatible schedules. Trust scoring incorporates the user's historical reputation and rating at 20%, promoting reliable and trustworthy ride-sharing experiences. Additional factors including rider availability and preferences account for the remaining 10% of the scoring algorithm.

### Dynamic Group Formation

Students can form ride groups with verified college peers, coordinate pickup points, and share ride costs efficiently. Groups form dynamically when two or more users achieve a combined compatibility score above the threshold of 0.6 and all constraints are satisfied, including female-only preferences and rider match requirements. The system enforces a confirmation timeout (configurable, default 5 minutes) to ensure timely group formation and prevent indefinite waiting periods.

### Real-Time Communication

Built-in group messaging enables riders and drivers to coordinate pickup times, share location updates, and communicate seamlessly within their ride groups. The WebSocket-powered real-time messaging system ensures instant message delivery and live updates without requiring users to refresh the application. Group chat history is preserved for reference, and users receive push notifications for new messages even when the app is in the background.

### Secure Authentication

Firebase Authentication provides robust security for user identities. The system supports email verification and enforces college domain restrictions, ensuring only verified students from partner institutions can access the platform. Server-side token verification protects all API endpoints, and phone numbers remain masked until group confirmation to protect user privacy.

### Comprehensive Notifications

Push notifications keep users informed about ride requests, group formation status, chat messages, and important platform updates. Users can customize their notification preferences to control which alerts they receive. The notification system is integrated with Firebase Cloud Messaging for reliable delivery across both iOS and Android devices.

### Admin Dashboard

A Telegram-powered admin bot provides comprehensive moderation tools for platform administrators. Admins can look up users, ban or suspend violators, view and resolve safety reports, monitor active groups, toggle maintenance mode, and access system statistics. All administrative actions are logged for audit purposes.

## Tech Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| Frontend | Flutter 3.x, Dart 3.x | Cross-platform mobile framework |
| Backend | FastAPI (Python 3.10+) | Modern async web framework |
| Database | MongoDB 6.0+ | Flexible document database |
| Cache | Redis 7.0+ | In-memory data store |
| Authentication | Firebase Auth | Secure identity management |
| Real-time | WebSockets | Live communication protocol |
| Maps | Google Maps API | Location services |
| Testing | Pytest | Python testing framework |

## Architecture

The project follows a modern client-server architecture with clear separation between frontend and backend components. The frontend is built with Flutter using a feature-based directory structure with state management through Riverpod providers. The backend uses FastAPI with a layered architecture including routers, services, and models for maintainability and scalability.

```
Orix-App/
├── frontend/                 # Flutter mobile application
│   ├── lib/
│   │   ├── core/            # Core utilities, services, and theme
│   │   │   ├── config/      # API configuration and constants
│   │   │   ├── providers/   # Riverpod state management
│   │   │   ├── router/      # Navigation and routing
│   │   │   ├── services/    # API, WebSocket, notifications
│   │   │   ├── theme/       # App theming and styling
│   │   │   └── utils/       # Helper utilities
│   │   ├── features/        # Feature modules organized by screen
│   │   │   ├── auth/        # Login and onboarding flows
│   │   │   ├── groups/      # Group formation and chat
│   │   │   ├── home/        # Main home screen
│   │   │   ├── notifications/   # Notification management
│   │   │   ├── profile/     # User profile and settings
│   │   │   ├── ride/        # Ride creation and matching
│   │   │   └── system/      # System screens
│   │   └── main.dart       # App entry point
│   ├── pubspec.yaml         # Flutter dependencies
│   └── ios/                 # iOS platform files
├── backend/                  # FastAPI backend server
│   ├── app/
│   │   ├── main.py          # FastAPI application entry
│   │   ├── config.py        # Pydantic settings
│   │   ├── database.py      # MongoDB and Redis connections
│   │   ├── dependencies.py  # Authentication dependencies
│   │   ├── models/          # Pydantic data models
│   │   ├── services/        # Business logic services
│   │   ├── routers/         # API endpoint routers
│   │   ├── middleware/      # Custom middleware
│   │   ├── telegram_bot/    # Admin Telegram bot
│   │   └── workers/        # Background workers
│   ├── tests/               # Pytest test suite
│   └── requirements.txt     # Python dependencies
└── README.md               # This file
```

## Getting Started

### Prerequisites

Before setting up the project, ensure you have the following installed and configured:

- Flutter 3.x with Dart 3.x for the mobile frontend
- Python 3.10 or higher for the backend server
- MongoDB 6.0+ running locally or on a cloud provider
- Redis 7.0+ for caching and real-time features
- Firebase project with Authentication enabled
- Google Maps API key for location services

### Frontend Setup

Clone the repository and navigate to the frontend directory. Install the Flutter dependencies and run the app on your preferred platform.

```bash
# Navigate to frontend directory
cd frontend

# Get Flutter dependencies
flutter pub get

# Run the app on your device/emulator
flutter run
```

### Backend Setup

The backend requires Python 3.10+, MongoDB, and Redis to be running. Create a virtual environment and install the required dependencies.

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv

# Activate on Linux/macOS
source venv/bin/activate

# Activate on Windows
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Environment Configuration

Copy the example environment file and configure your credentials.

```bash
# Backend configuration
cp backend/.env.example backend/.env
```

Configure the following environment variables in your backend `.env` file:

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK credentials (JSON string) |
| `MONGODB_URI` | MongoDB connection string |
| `REDIS_URL` | Redis connection string |
| `ALLOWED_COLLEGE_DOMAINS` | Comma-separated list of allowed email domains |
| `ADMIN_API_SECRET` | Secret key for admin API access |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for admin notifications |

### Running the Services

Start the backend server, matchmaking worker, and Telegram bot to run all required services.

```bash
# Backend API (Development)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Matchmaking Worker (separate terminal)
python -m app.workers.matchmaking_worker

# Telegram Admin Bot (separate terminal)
python -m app.telegram_bot.bot
```

## API Documentation

The FastAPI backend provides comprehensive interactive API documentation through Swagger UI and ReDoc.

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| Auth | `POST /api/v1/auth/verify` | Verify Firebase token |
| Auth | `POST /api/v1/auth/onboard` | Complete user onboarding |
| Users | `GET /api/v1/users/me` | Get current user profile |
| Users | `PUT /api/v1/users/me` | Update user profile |
| Rides | `POST /api/v1/rides` | Create ride request |
| Rides | `DELETE /api/v1/rides/{id}` | Cancel ride request |
| Groups | `GET /api/v1/groups` | Get user's ride groups |
| Groups | `POST /api/v1/groups/{id}/chat` | Send chat message |
| WebSocket | `WS /api/v1/ws` | Real-time updates |

### WebSocket Connection

Connect to the WebSocket endpoint for real-time updates:

```
ws://localhost:8000/api/v1/ws?token=<firebase_token>
```

## Matchmaking Algorithm

The intelligent matchmaking system evaluates potential ride pairs across four key dimensions. Route overlap scoring uses Haversine distance to measure pickup and drop-off proximity alongside directional alignment, contributing 40% to the final score. Time compatibility scoring calculates the overlap between user-specified time windows at 30% weight. Trust scoring incorporates the user's historical reputation at 20%, while additional factors like rider availability and preferences account for the remaining 10%.

Groups form when multiple users achieve a combined compatibility score exceeding 0.6, all constraints are satisfied including female-only preferences and rider matching criteria, and all participants confirm within the configurable timeout period (defaulting to 5 minutes).

## Security Features

The platform implements multiple layers of security to protect user data and ensure a safe environment. Firebase Auth provides server-side token verification for all API endpoints, ensuring only authenticated users can access protected resources. College domain validation restricts registration to verified institutional email addresses, preventing unauthorized access from external users. Rate limiting using a sliding window algorithm (default 60 requests per minute) protects against abuse and DoS attacks. Comprehensive audit logging records all administrative and significant user actions for accountability. Phone masking hides user contact details until group confirmation, protecting privacy during the initial matching phase.

## Testing

Run the backend test suite to verify functionality:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_matchmaking.py -v
```

## Screenshots

| Home Screen | Create Ride | Matching | Group Chat |
|:------------:|:-----------:|:--------:|:----------:|
| ![Home] | ![Create Ride] | ![Matching] | ![Chat] |

*Screenshots coming soon*

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

Orix was built with contributions from the ORIX Team. We thank all contributors and the open-source community for their support in building this platform for college students.
