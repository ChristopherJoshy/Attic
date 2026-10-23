# UNTANGLE — agents.md

> AI-powered shared expense & IOU tracker for roommates, trips, and friend groups.
> Real-time ledger, natural-language expense entry, receipt OCR, and an AI assistant scoped to your group's data.
> Terminal / ASCII aesthetic. Local-first. Powered by Groq.

---

## Quick start

```bash
# from project root
bun run dev          # Next.js app on :3000
# in a second terminal
cd mini-services/realtime && bun run dev   # socket.io on :3003
```

Environment (already in `.env`):

```
DATABASE_URL=file:./db/custom.db
GROQ_API_KEY=<your groq key>
SESSION_SECRET=<any random string>
```

Push the schema once: `bun run db:push`

Open the app in the **Preview Panel** (right side of the IDE). Only the `/` route is user-facing; everything else is API + a realtime mini-service.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (single page at /)                             │
│  ├─ AuthScreen   (login / register, local username+p/w) │
│  ├─ Dashboard    (group list, create, join)             │
│  └─ GroupView    (ledger · balances · settle · ai chat) │
│        └─ AddExpenseSheet (manual · NL · receipt OCR)   │
└───────────────┬───────────────────────┬─────────────────┘
                │  fetch (relative)     │  socket.io  /?XTransformPort=3003
                ▼                       ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│  Next.js 16 API routes    │   │  mini-services/realtime  │
│  /api/auth/*              │   │  socket.io on :3003      │
│  /api/groups/*            │   │  rooms = group:<id>      │
│  /api/groups/[id]/expenses│   │  + POST /broadcast       │
│  /api/groups/[id]/balances│   └──────────────────────────┘
│  /api/groups/[id]/settle  │           ▲
│  /api/groups/[id]/chat    │           │ server-to-server (localhost:3003/broadcast)
│  /api/groups/[id]/summary │           │ after every DB write
└──────────┬────────────────┘───────────┘
           │
           ▼
   ┌────────────────┐      ┌─────────────────────────┐
   │  Prisma +      │      │  Groq API               │
   │  SQLite        │      │  https://api.groq.com   │
   │  (file-based)  │      │  /openai/v1/chat/...    │
   └────────────────┘      └─────────────────────────┘
```

### Data flow (real-time)

1. A client calls `POST /api/groups/[id]/expenses` (or NL / OCR).
2. The route writes to SQLite via Prisma.
3. The route then `POST /broadcast` to the realtime service (`localhost:3003`) with `{ room: "group:<id>", event, data }`.
4. The socket service emits to every socket in that room.
5. All connected clients update their UI instantly — no refresh.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | required, server + API in one |
| Language | TypeScript 5 | required |
| Styling | Tailwind CSS 4 + custom terminal theme | ASCII/phosphor aesthetic |
| UI | shadcn/ui (restyled), Lucide icons, Framer Motion | fast, consistent, animated |
| DB | Prisma + SQLite (file) | local-first, zero infra |
| Auth | username + password, bcryptjs + jose JWT in httpOnly cookie | local, no external provider |
| Realtime | socket.io mini-service on :3003 | rooms per group, server-broadcast |
| AI | Groq API (OpenAI-compatible, `fetch`) | fast inference, vision + text |

---

## AI integration (Groq)

All AI runs server-side in API routes (the key never reaches the browser).

| Feature | Model | Mechanism |
|---|---|---|
| Natural-language expense parsing | `llama-3.3-70b-versatile` | `response_format: json_object` → structured `{amount, description, category, splitBetween, ...}` |
| Receipt OCR | `qwen/qwen3.6-27b` (vision) | image as base64 data URL in `image_url` content part → `{merchant, total, items[]}` |
| Group-scoped chat | `llama-3.3-70b-versatile` | group data (members, expenses, settlements) injected as context; last 10 turns of history |
| Monthly summary | `llama-3.3-70b-versatile` | concise bullet summary from full group context |

Client lives in `src/lib/groq.ts` (plain `fetch`, no SDK). Parsing functions return typed objects; the frontend lets the user **review before saving** (NL and OCR never auto-commit).

> Note: the vision model `qwen/qwen3.6-27b` is the only current Groq vision model. The older `llama-3.2-*-vision-preview` models were shut down 2025-04-14 — do not use them.

---

## Settle-up algorithm

Implemented in `src/lib/settle.ts` — greedy largest-balance matching:

1. Net balance per member = `paid − owed` (expenses minus recorded settlements).
2. Split into creditors (`net > 0`) and debtors (`net < 0`), sorted descending by magnitude.
3. Match the largest debtor to the largest creditor; transfer `min(debtor, creditor)`; reduce both; advance whichever hits zero.
4. Repeat until all balances clear.

This produces a near-minimal number of transactions (optimal for typical small groups). Each suggestion is a single `from → to` payment the user confirms with "mark paid".

---

## Database schema (Prisma)

- **User** — `id, username (unique), passwordHash, displayName`
- **Group** — `id, name, description, inviteCode (unique), currency, createdBy`
- **GroupMember** — join table `(groupId, userId)` unique
- **Expense** — `groupId, paidById, amount, description, category, splitType, source`
- **ExpenseSplit** — `expenseId, userId, amount` (one row per person sharing the cost)
- **Settlement** — `groupId, fromUserId, toUserId, amount, status`
- **ChatMessage** — `groupId, userId (nullable for AI), role, content`

SQLite doesn't allow list primitives, so splits are stored as separate rows (correct Prisma pattern).

---

## API surface

```
POST   /api/auth/register        { username, password, displayName? }
POST   /api/auth/login           { username, password }
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/groups               list current user's groups
POST   /api/groups               { name, description?, currency? }
POST   /api/groups/join          { inviteCode }

GET    /api/groups/[id]          full group (members, expenses, settlements)
POST   /api/groups/[id]/members  { inviteCode }   (legacy join, kept)

GET    /api/groups/[id]/expenses
POST   /api/groups/[id]/expenses { amount, description, category, paidById, splitType, splits, note?, source? }

POST   /api/groups/[id]/expenses/nl   { input }          → { parsed, resolved }   (preview only)
POST   /api/groups/[id]/expenses/ocr  { image: dataURL } → { receipt }            (preview only)

GET    /api/groups/[id]/balances      → { balances[], currency }
GET    /api/groups/[id]/settle        → { suggestions[], currency }
POST   /api/groups/[id]/settle        { fromUserId, toUserId, amount }

GET    /api/groups/[id]/chat          → { messages[] }
POST   /api/groups/[id]/chat          { question }       → { message }   (also broadcasts)
GET    /api/groups/[id]/summary       → { summary, currency }
```

Auth: every protected route calls `requireUser()` (reads the JWT from the httpOnly cookie). Group routes call `assertMember(groupId)` to enforce membership.

---

## Realtime events

Emitted by the socket service to room `group:<id>`:

| Event | Payload | Trigger |
|---|---|---|
| `expense:added` | the new expense (with paidBy + splits) | after `POST /expenses` |
| `settlement:added` | the new settlement | after `POST /settle` |
| `balance:update` | `{ groupId }` | after any write that changes balances → clients refetch `/balances` + `/settle` |
| `chat:message` | the chat message (user or AI) | after `POST /chat` (both user msg and AI reply) |

Client connects with `io("/?XTransformPort=3003")` (Caddy gateway forwards by query param). Server-to-server broadcasts go direct to `localhost:3003/broadcast`.

---

## File map

```
prisma/schema.prisma                data model
src/lib/db.ts                       Prisma client (singleton)
src/lib/auth.ts                     bcrypt + jose JWT, cookie session, requireUser
src/lib/groq.ts                     Groq client (fetch): chat, parseExpenseText, parseReceiptImage, chatAboutGroup, monthlySummary
src/lib/settle.ts                   computeBalances + suggestSettlements (greedy min-transactions)
src/lib/realtime.ts                 broadcast() helper → POST localhost:3003/broadcast
src/lib/groups.ts                   assertMember, handleError, buildGroupContext (AI context string)
src/lib/ascii.ts                    banners, money/date formatting, box-drawing helpers
src/lib/api.ts                      typed fetch client + shared interfaces
src/lib/socket.ts                   socket.io singleton + room join/leave

src/store/app.ts                    Zustand store (user, view, currentGroup)

src/app/layout.tsx                  mono font, terminal body, scanlines
src/app/globals.css                 phosphor-green-on-black theme, glow, CRT effects
src/app/page.tsx                    root: boot → auth → (dashboard | group)

src/components/ascii.tsx            Panel, Tag, Rule, AsciiBanner primitives
src/components/auth/AuthScreen.tsx  login/register
src/components/dashboard/Dashboard.tsx    groups list + create/join modals
src/components/group/GroupView.tsx        tabbed group view + socket wiring
src/components/group/ExpenseList.tsx      ledger
src/components/group/BalanceBoard.tsx     live balances
src/components/group/SettlePanel.tsx      optimal settle-up
src/components/group/ChatPanel.tsx        AI chat + monthly summary
src/components/group/AddExpenseSheet.tsx  manual · NL · receipt OCR

mini-services/realtime/index.ts     socket.io server (:3003) + /broadcast + /health
```

---

## Design language

- **Phosphor green on near-black** (`#00ff9c` on `#060807`) with amber accents (`#ffcc66`) for money.
- **Monospace everywhere** (Geist Mono).
- **Glow** via `text-shadow` on primary text and amounts.
- **CRT scanlines** + subtle flicker overlay (`.scanlines`, `.crt-flicker`).
- **Box-drawing** borders, `// section` headers, `[ action ]` buttons, blinking cursors on loading states.
- **Sticky header + sticky footer**; footer pinned to viewport bottom, pushed down on long pages.
- **Framer Motion** for tab transitions, list entry, and modal entrance.

---

## Notes / gotchas

- **Groq API key**: if AI calls return `403 Forbidden`, the key is likely revoked/regenerated — get a new one at `console.groq.com/keys`. All AI routes degrade gracefully (the chat returns an error message instead of crashing; NL/OCR return a 502 the frontend surfaces as a toast).
- **Vision model**: only `qwen/qwen3.6-27b` currently supports image input on Groq. Do not use the deprecated `llama-3.2-*-vision-preview` IDs.
- **Single user-facing route**: the whole app lives at `/` with client-side view switching (Zustand). All other routes are `/api/*`.
- **Local-only auth**: passwords hashed with bcryptjs (cost 10), session is a HS256 JWT in an httpOnly cookie (30-day expiry). No external auth provider.
- **Optimization**: Prisma query logging reduced to errors/warnings; socket reconnects infinitely; AI calls use `json_object` mode + Zod-free typed parsing for speed.
