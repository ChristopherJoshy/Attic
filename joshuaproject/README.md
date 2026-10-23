# Mount Enterprise — Product Catalogue Web App

A fast, client-side product catalogue web application for **Mount Enterprise**, built with vanilla HTML, CSS, and JavaScript.

## Project Structure

```
web/                    # The web application (Git-tracked)
├── index.html          # Main entry point
├── app.js              # Core application logic
├── orito.js            # Orito module
├── style.css           # Stylesheet
├── products_db.json    # Product database
└── assets/
    └── images/         # Product images and UI assets
```

## Getting Started

No build step required. Simply open `web/index.html` in a browser, or serve it with any static file server:

```bash
# Using Python (if available)
python -m http.server 8000 --directory web

# Using Node.js npx
npx serve web
```

Then visit `http://localhost:8000` in your browser.

## Deploy to Vercel

This project is fully configured for [Vercel](https://vercel.com) deployment.

### One-click via Vercel Dashboard
1. Push this repository to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository
3. In **Configure Project**, set the **Root Directory** to `web`
4. Leave **Framework Preset** as `Other` (no build step needed)
5. Click **Deploy** — done ✅

### Via Vercel CLI
```bash
npm i -g vercel
vercel --cwd web
```

### Vercel Settings (important)
| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework Preset | Other |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty)* |
| Install Command | *(leave empty)* |

## Features

- Browse the full Mount Enterprise product catalogue
- Search and filter products
- Chat assistant integration
- Fully offline-capable (no backend required)

## Tech Stack

- **HTML5** — semantic structure
- **CSS3** — custom styling with animations
- **Vanilla JavaScript** — zero dependencies
- **JSON** — product data store

---

> **Note:** Python data-processing scripts used to generate `products_db.json` from source PDFs are stored in `scripts/` (not tracked by Git).
