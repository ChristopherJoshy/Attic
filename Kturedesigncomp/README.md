# KTU Student Portal — Design Revamp

A calm, institutional-grade redesign of the Kerala Technological University student
portal. Built as a fast, accessible single-page application with **no backend** — every
screen is powered by rich, realistic mock data so the experience, motion, and layout can
be judged on their own merits.

> Front-end concept / competition entry. Not affiliated with or endorsed by KTU.

**Made by chrix.**

---

## Why this redesign

Most institutional portals optimise for density, not for the student who opens them at
11pm worried about a fee deadline. This revamp flips the priority:

- **Calm before clever.** One accent colour, hairline borders, soft shadows, generous
  whitespace. No red "alarm" cards — urgent things are signalled with tint and a single
  clear action.
- **Priority above the fold.** A quiet banner answers the only question a student cares
  about on arrival: *what do I need to do, and by when?*
- **Trend over position.** CGPA and attendance show direction (vs. last semester), not
  just a number, because that is what actually reduces anxiety.
- **A signature, not a template.** The loader is a typeset **ASCII "KTU" wordmark** that
  fades smoothly in and out — a small, deliberate motion that reads as crafted rather
  than default.
- **Housekeeping fixed.** Downloads were previously generating corrupt files. `admit
  cards`, `fee receipts`, `grade sheets`, and `certificates` now produce **real, valid
  PDFs** (and other artefacts) through a proper byte-level generator.

---

## Features

| Area | What you get |
| --- | --- |
| **Dashboard** | Priority banner, CGPA / attendance trend chips, recent notifications, quick actions |
| **Profile** | Programme, advisor, personal details, document summary |
| **Academics** | Semester records, credit progress toward graduation |
| **Attendance** | Per-course attendance with deficiency warnings |
| **Exams** | Timetable, admit card download (valid PDF) |
| **Fees** | Ledger, due items, receipt download (valid PDF) |
| **Suraksha** | Insurance policy view + certificate download |
| **Certificates** | Issuable certificates with grade-sheet download |
| **Calendar** | Academic timeline |
| **Notifications** | Full notification feed + priority filter |
| **Feedback / Grievance** | Submit flows with async state (signature loader) |
| **Command palette** | `⌘K` / `Ctrl+K` quick navigation |
| **Login** | Mock SSO-style entry, no credentials required |

Every numeric value uses tabular figures (`.nums`) so columns align and nothing shifts
as data loads.

---

## Tech stack

- **React 19** + **TypeScript**
- **Vite** (build) + **Tailwind CSS v3** (design tokens, not utility soup)
- **react-router-dom v7** — instant SPA navigation, no full-page blink
- **framer-motion** — restrained entrances only (no layout-thrash page transitions)
- **@tabler/icons-react** — every glyph is an icon; zero emoji in the UI

### Design system (in code)

- `tailwind.config.js` — single teal accent `#0F766E`, neutral ink palette, hairline
  borders, card / pop / focus shadows, `fade-up` + `shimmer` keyframes.
- `src/index.css` — `.card`, `.btn`, `.btn-primary`, `.input-field`, `.hairline`,
  `.skeleton`, `.nums`, focus rings, and a `prefers-reduced-motion` kill-switch.
- `src/lib/status.ts` — central `Tone` map so colour always means something (status, not
  decoration).

---

## Getting started

```bash
npm install
npm run dev        # local dev server
npm run build      # tsc -b && vite build  → dist/
npm run lint       # oxlint
npm run preview    # serve the production build locally
```

> Requires Node 18+.

---

## Deploy to Vercel

This repo is **Vercel-ready** out of the box.

1. Push this repo to GitHub.
2. In Vercel, **Import** the repository.
3. Vercel auto-detects Vite via `vercel.json` (`framework: "vite"`). If you prefer
   manual settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Deploy. Deep links (e.g. `/fees`) work thanks to the SPA rewrite in `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Static assets under `/assets/*` are served with `immutable` cache headers, and the app
ships with baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`).

---

## Project structure

```
src/
  components/      # AsciiLoader, Sidebar, TopBar, CommandPalette, Card,
                   # StatusPill, ProgressBar, Stat, PageHeader, Modal, …
  lib/             # mockData, download (PDF/text generators), status, motion, cn
  pages/           # Dashboard, Profile, Academics, Attendance, Exams, Fees,
                   # Suraksha, Feedback, Certificates, Calendar, Notifications,
                   # Grievance, Login
  App.tsx          # routes (instant navigation)
  index.css        # design tokens + component classes
vercel.json        # Vercel SPA config
```

---

## Accessibility & performance notes

- Instant route swaps and explicit transition properties (no `transition: all`) keep
  motion smooth and layout-stable.
- All animated motion is disabled under `prefers-reduced-motion`.
- Visible focus rings on every interactive element.
- Icons carry `aria-label`s; colour is never the sole carrier of meaning.

---

## License

Concept / educational use. Mock data only — no real student information is handled.
