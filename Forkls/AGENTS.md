# AGENTS.md

FORKLS marketing site. One hash-routed page whose entire payload (fonts, images, anime.js, CSS, JS)
is inlined into a single `index.html`. No framework, no backend, no lint/format/test/CI tooling —
don't introduce any.

## Generated vs editable

- Editable: `app.js` (page content, routing, interactions), `shell.html` (nav, footer, Finn, dialog),
  `style.css`, `assets/*.webp`, `assets/*.woff`.
- `index.html` is **generated** by `build.py`. Never hand-edit it; the edit is lost on the next build.
- This folder is **not a git repository**. There is no history to recover a clobbered artifact from.
- `output/` holds only `forkls-preview.jpg` (a screenshot of the homepage). It is not a build target.

## Build

```
python -m pip install -r requirements.txt   # Pillow is the only dependency
python build.py
```

Non-obvious build behaviour:

- `build.py` does literal string replacement on `shell.html` for the tokens `/* FONTS */`,
  `/* STYLES */`, `/* ANIME */`, `/* ASSETS */`, `/* APP */`. Keep them exact and unique.
- Asset embedding is **name-based**: an `assets/*.webp` is embedded only if its stem appears
  literally in the text of `app.js` + `shell.html`. A name built at runtime (`'company-'+x`) is
  silently dropped and the page renders `src="undefined"`.
- Existing `.webp` files are reused and never re-encoded. To swap artwork you must replace the
  `.webp` itself, or delete it so `build.py` regenerates it from `assets/generated/*.png`.
- New artwork gets the fallback `thumbnail((1100,1600))` at quality 82 unless its stem is added to
  the `quality` or `sprite_cells` dicts at the top of `build.py`.
- `build.py` asserts `'</script>'` never appears in `app.js` (it would close the inline script block).
- Windows: `Path.write_text` translates `\n` to CRLF. Every source file and the shipped `index.html`
  are LF. Normalise the rebuilt file back to LF if it must stay byte-comparable.

## Verify

```
node research/check-routes.cjs    # MUST be run from the repo root (it uses relative paths)
node --check app.js
python build.py                   # then hard-reload index.html in the browser
```

- `check-routes.cjs` evaluates `app.js` in a `node:vm` sandbox and **stops at `function hydrate(`**.
  Any top-level code added above that point runs during the check, so it must be DOM-free; the
  sandbox only provides `ASSETS`, `document.querySelector`, `matchMedia`, `URLSearchParams`.
- It fails a route when its markup lacks `<h1>`, contains the literal string `undefined`, or links to
  an `#/...` path missing from `routes`. Markup generated from data arrays must fill every field.
- `ASSETS` in the sandbox is faked from the filenames in `assets/`, so it validates naming, not pixels.
- Visual QA needs the dev server (the QA page loads `/index.html`, which `file://` cannot resolve):
  `npm ci && npm run dev`, then open `responsive-qa.html` for the five viewport presets and route jumps.
- After a UI change also check the 360×740 / 390×844 / 700×390 / 1024×768 / 980×1850 layouts, since
  several rules (pinned drone scene, grid reflow) only apply above specific breakpoints.

## Architecture

- **Routing** is hash-only: `#/path?query`. `render()` reads `location.hash`, replaces `main.innerHTML`,
  then tears down and re-runs every setup function. Anything page-level (listeners, observers,
  timelines) must be created from `render()` or it will leak across navigations.
- `routes` is an explicit map plus two generated families: `productFamilies` → `/motors/products/:id`
  and `applications` → `/drones/applications/:id` (39 routes today). Add a data entry to add routes.
- Assets are referenced two ways: the `img()` / `sprite()` helpers inline `ASSETS[name]` into JS-built
  markup, and `data-asset` / `data-sprite` attributes in `shell.html` are resolved after render by
  `hydrate()`. Both depend on the same global `ASSETS` injected by the build.
- `#/contact?type=X` preselects the `Enquiry` `<select>`, adding the option if it is missing.
- **Forms and Finn never send anything.** Forms build a text brief behind a `data:text/plain`
  download link; Finn replies come from the `chatKnowledge` keyword-regex table. Keep it that way —
  there is no AI service and no server behind this page.
- **Drone explode scene**: six `.drone-layer` elements share `drone-components-sheet.webp` (3×2 grid);
  each `.layerN` picks its cell with a CSS `background-position`. `setupScene()` measures the live grid
  to compute the assembly offsets, so `ratios` and `offsets` are index-coupled to those six layers —
  change one, change all three.
- **Sprite sheets** are 4 columns × 3 rows = 12 frames, row-major. `.sprite` carries
  `background-size:400% 300%`; `setupSprites()` drives `background-position` per element with
  subject-specific timing (question hand 180 ms + 2.6 s hold, compass 170 ms + 3 s, others 160 ms + 1.3 s)
  and pauses when offscreen or the tab is hidden.
- **Motion** is gated on `motionPaused`, seeded from `prefers-reduced-motion` and toggled by the footer
  button (`body.motion-paused`). Reveals, sprites, the hero intro and the scene all check it; new
  animation must too, and paused mode must leave content fully visible.
- Sprite frames loop **continuously** — there is deliberately no hold between cycles. If you add a
  pause, the question jar and compass read as stalled rather than as a held pose.
- `still(name, cls)` renders a sprite with its background but **without** `data-sprite`, so
  `setupSprites()` ignores it and it stays on frame 0. Use it for art that must not animate (the CTA
  balloon). Anything using `sprite()` is frame-animated automatically.

## Hero scene (home page)

- `.hero-scene` is a **size container** (`container-type:size`), so `cqw`/`cqh` inside it resolve
  against the illustration box. Sprite sizes use container units, never viewport units, so they
  track the artwork.
- The landscape's sky is **transparent** (see `assets/generated/README.txt`). That is what lets the
  clouds and the balloon sit behind it. Layers: clouds `z-index:1`, balloon `2`, landscape `4`.
- Clouds wrap left→right and fade out at one edge and back in at the other, so the loop point is
  never a visible jump. A cloud that wraps a full viewport width is off-screen for most of its
  cycle — that is why the drift distance is bounded and the ends are faded, not why it is short.
- The balloon must stay on screen: it sways on `.hero-drift` (an alternating pass) while
  `.hero-balloon` carries the bob/tilt keyframes. An earlier full-width wrap left it invisible for
  about a minute after load.
- `.motion-paused` and `prefers-reduced-motion` both set `animation:none` on the clouds, drift and
  balloon, which parks each one on its composed `left`/`top`. Give every drifting element a resting
  position so that still frame looks deliberate.
- **Desktop hero is a flex column with a definite `height`**: the headline block is `flex:0 0 auto`
  and the scene takes the remainder with `flex:1 1 auto`. Do not give `.hero-scene` a fixed height on
  desktop — the text then overflows past the fold. The headline is capped by `svh` as well as `vw`
  for the same reason. Desktop only; `max-width:1100px` and below keep the original fixed heights.
- `.explode-stage` is a stacking context so the dashed assembly ring can sit at `z-index:-1` behind
  the parts. Do not give `.part-slot` a `z-index` — that would trap the `.layerN` z-indexes inside
  each slot and break the assembled drone's stacking order.

## Buttons

`.pill` has no rest shadow. The hover shadow is `.pill::after` at `z-index:-1` — a `box-shadow`
cannot carry the hatch texture, and the negative-z pseudo is what lets the offset sliver show past
the button's own fill. The dropdown uses a solid ink `box-shadow` instead.

## Content constraints

- Imagery is illustrative. Never state dimensions, availability, lead times, pricing or performance as
  fact, and never invent names, roles or dates for people in the photos. `SOURCE_NOTES.md` records
  that this was previously got wrong.
- Keep the "nothing is sent / confirm with FORKLS" wording on forms, chat, privacy and the news article.
- Provenance lives in `SOURCE_NOTES.md` and `assets/generated/*.json` — update them when artwork or
  source material changes.
- `QA_NOTES.md` is the dated revision review log; append to it when finishing a revision pass.
- `FILE_MANIFEST_SHA256.txt` inventories the shipped package. Regenerate it after intentional file
  additions or deletions.

## Deploy

Static host entry point is `index.html`. For the bundled Sites project, copy the rebuilt file to
`hosted-forkls/dist/index.html` (`hosted-forkls/.openai/hosting.json` sets `static.directory: dist`;
`dist/` does not exist yet).
