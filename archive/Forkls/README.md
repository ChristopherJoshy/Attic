# FORKLS — complete frontend project

Public site: https://forkls-flight.cse-asthra.chatgpt.site

## Open the website

Open `index.html` directly in a browser. The entire frontend is in this single file: images, animation frames, fonts, CSS, JavaScript and anime.js are embedded. The website works offline; links to the official FORKLS website need an internet connection.

## What's included

- The complete standalone HTML and all editable source files.
- 39 page routes covering motor systems, drone solutions, company, News and contact.
- A responsive six-part drone exploration scene with scroll and manual controls.
- Image-generated frame animations for a balloon, maple leaves, a compass and the question jar. The illustrations are bitmap artwork, not code-drawn graphics.
- Original FORKLS navigation and footer logos, engineering blueprint and authentic company photography.
- A stationary Finn guide with local topic answers and navigation.
- Source PNG artwork, prompts, provenance, optimized WebP assets and embedded font files.
- A responsive review page and route validation script.

## Edit and rebuild

- `shell.html` contains the navigation, footer, guide and chat shell.
- `style.css` contains the responsive layouts, typography and colours.
- `app.js` contains page content, routing and interactions.
- `assets/` contains optimized WebP artwork and WOFF fonts.
- `assets/generated/` contains the original artwork and generation prompts.
- `research/anime.js` contains anime.js 3.2.2.
- `build.py` embeds the source and used assets into the HTML.

Install Python 3 and Pillow, then run:

    python3 -m pip install -r requirements.txt
    python3 build.py

The build updates `index.html`, the single deployable standalone file. Existing optimized WebP files are reused. When replacing artwork, replace the corresponding WebP too, or remove it before rebuilding.

Sprite sheets use a 4-column × 3-row grid of 12 equal square frames, played in row-major order. Keep this geometry when replacing them. The drone component sheet has a separate 3-column × 2-row grid. Frame animation stops offscreen and respects the motion control and reduced-motion preference.

## Optional development preview

    npm ci
    npm run dev

Use the local URL printed by Vite. Re-run `python3 build.py` after editing source. `responsive-qa.html` provides phone, tablet, landscape and tall viewport checks plus route jumps into the drone scene and News.

    node research/check-routes.cjs

The route check verifies headings, required assets and internal page links.

## Frontend behaviour

Forms validate inputs and prepare downloadable text briefs. They do not send enquiries, submit orders or collect payments. Finn is a local website guide; no connected AI service or backend is included. Official contact links are available to share a prepared enquiry.

Generated drone and motor images explain concepts and do not define exact production assemblies or measured performance. Product details, availability and operating limits should be confirmed with FORKLS.

## Hosting

Deploy `index.html` as the entry point to any static host. There is no external runtime asset dependency. The existing Sites project manifest is included for continuity. For that project, copy the rebuilt `index.html` into `hosted-forkls/dist/index.html` before publishing.

`SOURCE_NOTES.md` records original company material and the reference. `assets/generated/` includes image prompts and frame metadata. anime.js uses the MIT license; Instrument Serif and DM Sans use the SIL Open Font License. Brand assets remain associated with their owners.

Installed dependencies, Git history, temporary transfer tools and duplicate deployment outputs are excluded from this portable source package.
