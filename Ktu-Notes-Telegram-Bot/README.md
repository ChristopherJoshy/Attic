# KKNotes Bot

[![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)](https://www.python.org)
[![aiogram](https://img.shields.io/badge/aiogram-v3-red?logo=telegram)](https://aiogram.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Compatible-green?logo=mongodb)](https://www.mongodb.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Telegram](https://img.shields.io/badge/Telegram-Chat-blue?logo=telegram)](https://t.me)

A production-ready Telegram bot (aiogram v3) for browsing and submitting academic resources with MongoDB storage.

---

## Quick Stats

| Metric | Value |
|--------|-------|
| **Language** | Python 3.11+ |
| **Framework** | aiogram v3 |
| **Database** | MongoDB (with in-memory fallback) |
| **License** | MIT |

---

## Features

- Browse and search academic resources
- Submit new notes and study materials
- Admin panel for content moderation
- Automatic expiry of pending submissions
- Fallback to in-memory storage when MongoDB unavailable

---

## Screenshots

> *Add your screenshots here*

<!--
Place screenshots in the `assets/` folder and reference them:
![Bot Preview](assets/preview.png)
-->

---

## Requirements

- Python 3.11+
- Telegram Bot token
- Optional: MongoDB (local or Atlas). If MongoDB is unavailable, the bot falls back to in-memory storage.

---

## Setup

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the project root:

```env
# Required
BOT_TOKEN=your_telegram_bot_token

# Optional (defaults shown)
MONGODB_URI=mongodb://0.0.0.0:27017
DATABASE_NAME=kknotes_bot
ADMIN_IDS=1844964834
PENDING_EXPIRY_DAYS=20
```

---

## Run

Start the bot:

```bash
python main.py
```

---

## Project Structure

```
├── main.py       — Entrypoint; starts polling
├── bot.py        — Bot/dispatcher setup and command config
├── handlers.py   — User flows for browsing and submitting resources
├── admin.py      — Admin review actions (approve/reject, stats)
├── db.py         — MongoDB wrapper with in-memory fallback
├── config.py     — Environment variables and texts
└── .env          — Configuration file (create from .env.example)
```

---

## Notes

- Logging writes to stdout and to `bot.log`
- Admin panel is available via `/admin` for user IDs in `ADMIN_IDS`
- Pending submissions auto-expire using a TTL index when MongoDB is enabled

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

For questions or support, reach out via [Telegram](https://t.me) or open an issue on GitHub.
