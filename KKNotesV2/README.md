# KKNotes V2

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

A modern, fast notes and videos platform built with React (Vite) and an Express server, backed by Firebase Auth + Realtime Database + Storage. Includes an enhanced Admin Panel for content management, statistics, and user/admin roles.

> Made by Christopher Joshy

---

## Quick Stats

| Metric | Value |
|--------|-------|
| **Frontend** | React 18 + Vite |
| **Backend** | Express + TypeScript |
| **Database** | Firebase Realtime DB |
| **Authentication** | Firebase Auth (Google) |
| **UI Framework** | shadcn/Radix UI + Tailwind |
| **State Management** | React Query |
| **Routing** | Wouter |

---

## Features

- Browse by semester and subject (s1–s8)
- Global search with filters (semester, subject, type, sort)
- Notes and videos stored under nested RTDB paths; counters for downloads/views
- Admin panel: upload via URL, inline edit/move items, delete, statistics, manage admins/users
- Auth with Google; admin role detection with live updates

---

## Tech Stack

- **Frontend**: React 18, Vite, shadcn/Radix UI, Tailwind, React Query, Wouter
- **Backend**: Express + Vite dev middleware, TypeScript
- **Data**: Firebase Auth, Realtime Database, Storage

---

## Monorepo Layout

```
KKNotesV2/
├── client/          # Vite app (entry: client/index.html, src in client/src)
├── server/          # Express server (server/index.ts) serving API and client in prod
├── shared/          # Shared TypeScript types (shared/schema.ts)
└── package.json     # Root package with workspaces
```

---

## Screenshots

> Add your screenshots here

<!--
![Home Page](screenshots/home.png)
![Admin Panel](screenshots/admin.png)
![Search](screenshots/search.png)
-->

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the repo root (or supply via shell):

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime Database URL |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Measurement ID (optional) |

### 3. Development

```bash
npm run dev
```

Runs Express API + Vite dev server. Server listens on `PORT` (default: 5000).

### 4. Production

```bash
npm run build
npm start
```

The client is built into `dist/public` and served by Express.

---

## Admin Guide

The Admin Portal is accessible from the avatar dropdown when logged in as an admin.

### Admin Capabilities

- Manage admins (add/remove; head admin protected)
- Promote users to admin role
- Edit/move content
- Delete items
- View statistics

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Keep changes small** and type-safe
2. **Add tests** where reasonable
3. **Follow existing code style** and conventions
4. **Use meaningful commit messages**

To contribute:

```bash
# Fork the repository
# Create a feature branch
# Make your changes
# Submit a PR
```

---

## License

MIT License — see the [LICENSE](LICENSE) file for details.
