# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal portfolio site for nathanhattrup.com. Zero-build HTML/CSS/JS — no bundler, no package manager, no framework. Hosted on GitHub Pages from the `nathanhattrup/nathanhattrup.com` repo (see `CNAME`).

## Architecture

- **CSS base:** [LaTeX.css](https://github.com/vincentdoerig/latex-css) — academic/scientific document aesthetic with light/dark mode support
- **Layout:** Fixed left sidebar nav on desktop. On mobile (≤1025px) it becomes a slim fixed top band (`.nav-toggle` "Menu" button, `--mobile-nav-h` tall) that persists on scroll; tapping it drops down the nav list + theme toggle (`.nav-open` class on `.sidebar`, handler in the shared bottom script — closes on outside click/Escape). Pages use `has-sidebar` body class + `.content` wrapper
- **Fonts:** Latin Modern (primary) and Libertinus (secondary), self-hosted in `fonts/` (WOFF2/WOFF/TTF)
- **JS:** Vanilla JS only — lightbox, back-to-top, progress bar, table scroll wrapping. No framework
- **Prism.js (inert):** `prism/prism.css` (v1.21.0, prism-tomorrow theme) is linked on 6 pages, but **`prism/prism.js` is not loaded anywhere** — no page has a highlighted code block. The CSS is dead weight; either wire up the JS or drop both if a page ever needs real syntax highlighting

## Pages

Seven pages. Common shell: `<header>` → `.abstract` → `<main><article>`, sidebar nav links between them. Only `courses`, `projects`, and `trips` carry a `nav.toc-dotfill`; `index`, `books`, `lifts`, and `gates` have none.

| File | Content |
|------|---------|
| `index.html` | Bio, travel globe, "Currently" list |
| `courses.html` | Favorite Classes, Timeline (gantt table), Full Transcript |
| `projects.html` | School Projects, Personal Projects (YouTube embeds) |
| `trips.html` | School Trips, Personal, Backpacking — 9 photo galleries |
| `books.html` | Bookshelf: Favorites, Currently Reading, All (cover grid / list toggle, sortable) |
| `lifts.html` | Maxes & Meet Results, Progress (5 charts) |
| `gates.html` | Gates: daily logic-gate puzzle (NYT-style). Game-first page — header, short abstract, then the game; no TOC |

All seven have identical shared bottom-script blocks (clean URLs, theme toggle, mobile nav, back-to-top + progress bar, lightbox, table wrap) and identical sidebar nav markup. Keep them in sync.

`experience.html` was deleted (2026-08) — no dangling references remain in any page, the sidebar, or `sitemap.xml`. Don't reintroduce it into docs or nav.

## Key Files

- `style.css` — Main stylesheet, extends LaTeX.css. Organized into `/* ==== */` banner sections. Colors flow from a `--token-*` palette (`--token-orange`, `--token-lime`, …) defined per theme, which the `--chart-*` variables alias
- `assets/globe.js` — Travel globe rendering (tunable constants at top: `SPIN_SPEED`, `RESUME_DELAY`, `PIN_COLOR`, `PIN_SCALE`, `BORDER_COLOR`, `BORDER_WIDTH`, `START_VIEW`, `EDGE_MARGIN`)
- `assets/locations.js` — Globe pin data (43 places); to add one, append `{ name, lat, lon }` (ballpark coords fine)
- `assets/d3.v7.min.js` (v7.9.0), `assets/topojson-client.min.js` (v3.1.0), `assets/land-110m.js`, `assets/countries-110m.js`, `assets/us-states-110m.js` — Self-hosted globe dependencies; all geo data (coastlines, country polygons, US state lines) is wrapped as JS `const`s (not fetched JSON) so the site still works when opened via `file://`. All carry a provenance banner except `land-110m.js`
- `assets/books.js` — Bookshelf data (30 books); each entry: `slug` (cover filename), `title`, `author`, `read` ("YYYY" or "YYYY-MM", internal sort only, never displayed), optional `format: "audio"`, optional `fav: true` (Favorites section), optional `current: true` (Currently Reading section; excluded from the All shelf, no `read` date needed), optional `sortTitle`/`sortAuthor` overrides
- **Book covers:** drop a jpg at `images/books/<slug>.jpg`. The header comment in `books.js` tells you to run `get_cover.py`, but **that script is not in the repo** — add covers manually (or restore the script and fix the comment)
- `assets/nathanhattrup.csv` — Raw OpenPowerlifting export (plus manually added rows) feeding the lifting charts; `assets/lifting-data.js` is generated from it by `python3 make_lifting_data.py` (rerun after every CSV update)
- `assets/lifting.js` — Lifting chart rendering (tunables at top: `EVENTS` markers, `CHART_HEIGHT`, `DOT_R`, `X_PAD_DAYS`, `Y_PAD_FRAC`); series colors are the `--chart-*` CSS variables in `style.css` (per-mode values validated for contrast in light and dark)
- `gates-backend-spec.md` — Original design spec for the Gates puzzle (ruleset, dating scheme, storage schema, invariants). Read it before touching any Gates code; its §13 invariants still hold. **The build has since diverged from it on purpose** — where they disagree, the code wins: 168 puzzles not 200 (max one XOR/XNOR per puzzle), a winning submission costs no life, gate usage is weighted, the header shows no date, and the archive is disabled. The spec has not been rewritten to match
- `make_gates_data.py` — Generates `assets/gates-data.js` (`const GATES_DATA`, `version: 4`, 168 puzzles, ~19 KB; ruleset caps XOR/XNOR at one per puzzle, which prunes the 200-class space to 168). Fully deterministic (`SHUFFLE_SEED = 20260101`, frozen); `EPOCH = "2026-08-09"` is the launch date and must NEVER change after launch — it remaps every past date's puzzle and corrupts stored histories/share strings. Gate mix is steered by `GATE_WEIGHTS` (target %: AND/OR 20, NAND/NOR 17.5, XOR 15, XNOR 10) with `NOT_PENALTY = 0.2` trading extra NOT bubbles against distribution fit; achieved mix is best-effort (~±1 pt) because each class's final gate is fixed. Output is committed; rerun only if the ruleset changes. Tests: `test_gates_data.py` (invariants, self-consistency, byte-reproducibility; run via pytest or a loop calling its `test_*` functions)
- `assets/gates.js` — All Gates game logic in one classic-script IIFE (dating, storage `STORE_KEY = 'gates.v4'`, circuit SVG, tri-state table, lives, share, archive, tutorial modal). Gate drawings come from `GATE_SHAPES`/`gateMarkup()`: real ANSI distinctive shapes (AND D-body, OR/XOR swoosh) with a tip bubble for the N-variants — never labeled boxes. The same helper draws the six labeled symbols injected into the tutorial's `.gates-sym` spans, so the legend can't drift from the circuit. **All player-facing message text lives in the `STRINGS` object at the top of the file** — edit freely, `{curly}` placeholders are filled by code; tutorial/how-to-play prose is static HTML in `gates.html`. Key rules: C/D scratch columns are NEVER validated or marked; Q feedback is one bit; duplicate detection compares Q only; only wrong submissions spend a life (win/duplicate/incomplete are free); archive plays never touch the streak; player-facing number is the unwrapped day count, puzzle id stays internal. **Archive is currently disabled** — commented out in `gates.html` (the `#gates-archive` block) and in `init()` (uncomment both to restore the 10-wide puzzle-number grid + `?date=` replay)
- `compress_images.py` — Image optimization script (requires `pip install Pillow`)
- `images/favicon/` — Site icon: `favicon.svg` (source of truth; "NH" from LM-bold.ttf converted to paths + red rule, ink flips via `prefers-color-scheme` media query inside the SVG), `favicon-32.png` fallback, `apple-touch-icon.png` (180px, white bg). All 7 heads link all three. To change the design, edit/regenerate the SVG then re-rasterize the PNGs from it (render at 8x scale in headless chromium, downscale with Pillow — rasterize from a copy with the dark-mode media query stripped, headless chromium may render dark)
- `sitemap.xml` / `robots.txt` — SEO plumbing; sitemap lists all 7 clean extensionless URLs. Each page head also carries a `rel="canonical"` link with its clean URL and a unique `<meta name="description">`
- `images/` — Compressed site images, organized by topic subfolder (`books`, `favicon`, `japan`, `ntier`, `nyc`, `phil21`, `phil23`, `proj`, `rmhab`, `switz22`, `switz25`, `tahosa`)
- `images_og/` — Original uncompressed image backups (~283 MB; `images/` is ~52 MB)
- `lang/` — 19 language CSS files inherited from LaTeX.css i18n (not used by any page)
- `.gitignore` lists `CLAUDE.md` and `.claude`, but **this file is already tracked** — `.gitignore` only affects untracked paths, so edits here still show up in `git status`

## Domain, hosting, and DNS

Durable facts about the deployment, worth not rediscovering:

- **Repo → Pages:** project repo `nathanhattrup/nathanhattrup.com` with a `CNAME` of `www.nathanhattrup.com`. `nathanhattrup.github.io/nathanhattrup.com/*` returns `301` to the custom domain — that redirect is the healthy signal, not an error
- **DNS:** GoDaddy nameservers (`ns55`/`ns56.domaincontrol.com`). Apex has GitHub Pages A records (`185.199.108-111.153`); `www` is a CNAME to `nathanhattrup.github.io`
- **Mail posture (domain sends no mail):** `TXT @ v=spf1 -all`, null MX (`0 .`, RFC 7505), and `_dmarc` at `v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:nahattrup@gmail.com`. The `rua` target is a Gmail address on a different domain and Gmail publishes no RFC 7489 §7.1 authorization record, so aggregate reports will not arrive — expected, not a fault. The `p=reject` policy is unaffected
- **CAA:** `0 issue "letsencrypt.org"` + `0 issuewild ";"`. GitHub Pages uses Let's Encrypt, so this is safe today. **This record will break a host migration** — update it before moving to any provider using a different CA
- **DNSSEC:** enabled (DS at the registry, DNSKEY published, answers validate)
- **Google Search Console:** verified as a *Domain* property via the `google-site-verification=` TXT record on the apex. **Never delete that TXT record** — removing it unverifies the property
- **Known issue — CUJO AI / Spectrum block.** Since 2026-08-09 the domain has been blocked at the SNI layer by CUJO AI (the engine inside Spectrum's Security Shield) on some consumer ISP networks. Symptom is a bogus TLS error (`SSL received a record that exceeded the maximum permissible length`, or curl's `wrong version number`) because the filter answers the TLS ClientHello with a plaintext HTTP redirect to `block.charter-prod.hosted.cujo.io`. **This is not a site defect and page content cannot fix it** — the filter never fetches a byte of HTML; it scores domain reputation off-page. Consequence for local work: you may be unable to load the live site from an affected network. Verify deploys via `nathanhattrup.github.io/nathanhattrup.com/`, a VPN, or cellular

## Image Compression

Run from repo root:
```bash
python3 compress_images.py                  # defaults: quality 80, max-width 1920px
python3 compress_images.py --quality 70 --verbose
python3 compress_images.py --dry-run        # preview without changes
```
Also accepts `--images-dir` (default `images`). Note two `.HEIC` files are tracked under `images/ntier/` and `images/phil21/` that the script does not handle.

## Interactive Features

- **Dark mode toggle** — "Dark Mode"/"Light Mode" button in the sidebar nav (below the page list; inside the mobile dropdown, centered at its bottom). Toggles `latex-dark` class on `<body>`; preference stored in `localStorage.theme` (`"dark"`/`"light"`), shared across all pages. Default is light — dark only when the key is exactly `"dark"`. Three synced pieces on every page: (1) a one-line `<script>` right after `<body>` applies the class pre-paint (no flash), (2) the `.theme-toggle` button in the sidebar, (3) the toggle handler in the shared bottom script (also fires a synthetic `resize` event so the globe canvas redraws in the new ink color). Button styles in `style.css` next to the sidebar rules.
- **Mobile nav dropdown** — On ≤1025px the sidebar becomes a slim fixed band at the top of the viewport (persists on scroll): a single full-width "Menu ▾" `.nav-toggle` button, `--mobile-nav-h` (2.5rem) tall, page bg + thin bottom border. Tapping toggles `.nav-open` on `.sidebar`, revealing the `<nav>` as a dropdown overlay: vertical centered link list (numbering suppressed), theme toggle at bottom; caret flips ▾/▴ via `aria-expanded`. Closes on outside click or Escape. Handler is an IIFE in the shared bottom script (keep in sync across pages, like the theme toggle); styles live in the `@media (max-width: 1025px)` sidebar block in `style.css`. Body gets mobile `padding-top` to clear the band and `scroll-padding-top` so anchor jumps aren't hidden. Desktop (≥1026px) unchanged — `.nav-toggle` is `display: none` there, and print hides the whole sidebar.
- **Clean URLs** — snippet in the shared bottom script strips `.html` from the address bar via `history.replaceState` (`/trips.html` → `/trips`, `/index.html` → `/`; search + hash preserved). Works because GitHub Pages serves `page.html` at `/page` natively. Skipped on `file://` — internal links deliberately keep `.html` so local file testing works.
- **Travel globe** (`index.html` Travel section) — B/W lineart canvas globe (d3-geo orthographic projection, coastlines + graticule, gray country borders + US state lines) with red pins for visited places. Country borders come from `topojson.mesh` with an `a !== b` filter (inland edges only); US state lines are Natural Earth 110m admin-1, US-filtered. Auto-spins at 20°/s, drag to rotate (mouse/touch), spin resumes 0.5s after release. Respects `prefers-reduced-motion` (no auto-spin). Line color follows page text color so dark mode works automatically. Hidden in print. Pin data lives in `assets/locations.js`; the `#globe` div is capped at `max-width: 500px`.
- **Bookshelf** (`books.html`) — Two optional fixed sections on top, above the sort toolbar: **Favorites** (`fav: true` in `books.js`) then **Currently Reading** (`current: true`). Both use the same design — covers + title/author/format text, alphabetical by title, rendered once at load, unaffected by the toolbar — via the shared `renderFixedSection(id, pick)` helper. Each section's `<h2>` and intro text are **static HTML inside `<div id="favorites">` / `<div id="currently-reading">`** — edit them directly in the page; JS appends only the covers grid, and hides the whole div (static text included) when no book matches. The `<h2>All</h2>` above the toolbar is static HTML too. Below the toolbar the full shelf renders into `#shelf` (favorites repeat here; `current: true` books do **not** — they're filtered out of `sortedBooks()` and live only in Currently Reading): cover-grid/list toggle + sort by recent/title/author (asc/desc, click active sort again to flip). State persists in localStorage; `#list`/`#covers` URL hash overrides view. Clicking a book opens the lightbox with a caption bar (title — author, audiobook tag). Title sort ignores leading "The/A/An"; author sort uses last name. Rendering is all client-side from `assets/books.js`. Dark-mode button styles are scoped to `.latex-dark`/`.latex-dark-auto` (used by the site-wide dark mode toggle).
- **Lifting charts** (`lifts.html` Progress section) — five separate d3 SVG line charts (squat/bench/deadlift/total/DOTS), one series each, drawn into `.liftchart[data-metric]` divs from `assets/lifting-data.js` (kg; generated from the CSV). Lift/total charts plot in lbs with a right-hand axis relabeling the same scale in kg (exact conversion, not a second scale); DOTS is unitless. Tight y-range, hairline grid, dashed vertical event markers (dates/labels in the `EVENTS` array at the top of `lifting.js`; labels drawn only on the chart with `data-event-labels` — currently just the squat chart). Hover/tap shows a crosshair + tooltip (value, meet, date); arrow keys step through meets when a chart is focused. A Meet Results table below carries every charted value (tbody filled by JS into `#meet-results-body`). Redraws on resize; theme toggle's synthetic resize re-reads the `--chart-*` colors for dark mode.
- **Gates daily puzzle** (`gates.html`) — one fixed-topology circuit per day (A/B → two gates → C/D → final gate → Q); player fills the 4-bit Q column in a tri-state table (tap cycles empty→0→1), 3 lives, all-or-nothing feedback. Header is just "No. n" — no date shown. Daily puzzle keyed to the **local calendar date** (`dayNumber`/`puzzleIdForDate` in `gates.js` — never `toISOString`, never elapsed time); 168-puzzle list (max one XOR/XNOR gate per puzzle) wraps via modulo, epoch 2026-08-09. C/D are optional scratch revealed only after the day resolves. Share string is checks/Xs + unwrapped day number, copied to the clipboard. Archive (currently commented out) replays any `[epoch, today]` date via `?date=YYYY-MM-DD` from a 10-wide puzzle-number grid (recorded `archive: true`, never affects streak). Tutorial modal opens on first run and from the "How To Play" button: intro prose plus one card per gate — labeled A/B/Q schematic symbol, Boolean equation (`AB`, `A + B`, overline for NOT, ⊕ for XOR), plain-English description, truth table. All of it is static HTML in `gates.html` except the symbols, which JS injects. State in `localStorage["gates.v4"]`, every read try/catch'd.
- **Lightbox with gallery nav** — clicking any image opens fullscreen overlay. Images inside a `.gallery` div get per-gallery prev/next arrows + keyboard left/right navigation. Standalone images open without arrows.
- **Photo gallery grid** — trip photos wrapped in `<div class="gallery">` render as 2-column CSS grid (1-column on mobile) with hover zoom. Figure numbering suppressed inside galleries. Only `trips.html` uses this (9 galleries).
- **Reading progress bar** — `<div class="progress-bar">` at top of each page, width updated on scroll via JS.
- **Back-to-top button** — fixed bottom-right, appears after 400px scroll.
- **Responsive video embeds** — YouTube iframes wrapped in `<div class="video-wrap">` for 16:9 aspect-ratio scaling. Only `projects.html` uses this (6 embeds).
- **Table scroll wrapping** — JS auto-wraps `article table:not(.gantt)` in `.table-scroll-wrap` for mobile horizontal scroll. The `.gantt` exemption is for the Timeline table in `courses.html`.
- **Sidenotes (unused)** — LaTeX.css sidenote plumbing (`.sidenote`, `label.sidenote-toggle`, click-to-expand below 1050px) is fully styled in `style.css` but no page uses it. Available if wanted; safe to ignore.

## Vault Sync

When asked to "update my vault with current website content" (or similar), export page prose to Nat's Obsidian vault as markdown. Read `/mnt/windows/Users/nahat/Documents/VAULT/CLAUDE.md` first (vault rules; external-project writes go to `VAULT/claude/`).

- **Targets:** `index.html` → `Home.md`, `courses.html` → `Courses.md`, `projects.html` → `Projects.md`, `trips.html` → `Trips.md`, `lifts.html` → `Lifts.md`. Skip `books.html`, and skip `gates.html` (a game — its text is UI chrome and tutorial copy, not writing).
- **Overwrite** the existing files in `VAULT/claude/` — full re-export, not a diff. If Nat has promoted a note out of `claude/` (check `fd -e md <name>` in vault), update it in place instead of recreating in `claude/`.
- **Capture:** written text, headings, and tables only. Convert HTML tables to markdown tables; summarize the courses gantt chart as a small text table. Keep footnotes.
- **Images/videos:** don't copy. Note them in `> [!note]` callouts — galleries as one callout summarizing captions with the folder path (e.g. `images/japan/`), standalone images with caption + path, YouTube embeds as plain links.
- **Links:** cross-page site links become `[[wikilinks]]` (e.g. `[[Trips]]`); external links stay markdown links.
- **Style:** each note starts with `# Title` and an *"Imported from nathanhattrup.com <file>"* line. Fix obvious typos in transcribed prose; never edit the HTML. Omit site chrome (sidebar nav, TOC dotfill, lightbox/JS).

## Conventions

- Semantic HTML5 elements throughout (`<article>`, `<figure>`, `<figcaption>`, `<aside>`)
- TOC uses `nav.toc-dotfill` with dot-leader styling (only on `courses`, `projects`, `trips`)
- Current page marked with `aria-current="page"` in sidebar nav
- All shared JS (clean URLs, theme toggle, mobile nav, lightbox, progress bar, back-to-top, table wrap) is inline in `<script>` at bottom of each HTML file — keep in sync across all 7 pages when modifying
- Every page head carries: `<title>`, unique `<meta name="description">`, `rel="canonical"` with the clean URL, and the three favicon links
- Media query breakpoints in `style.css`: 500px (globe cap), 640px (phone overrides), 1025px (sidebar collapse; 641–1025px is the tablet band), 1050px (sidenote collapse)
- Print stylesheet hides sidebar, lightbox, progress bar, back-to-top; shows link URLs inline
- No build step — edit HTML/CSS directly and open in browser to test. `python3 -m http.server` from the repo root is the usual local check when `file://` isn't enough
