# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project Overview

Static personal portfolio site for **nathanhattrup.com**. Zero-build HTML/CSS/JS — no bundler, no package manager, no framework, no CI. Every dependency is vendored into `assets/`. Hosted on GitHub Pages from `nathanhattrup/nathanhattrup.com` (see `CNAME`).

Edit a file, reload the browser. That is the whole loop.

- **CSS base:** [LaTeX.css](https://github.com/vincentdoerig/latex-css) — academic/scientific document aesthetic, extended heavily in `style.css`
- **Fonts:** Latin Modern (primary) and Libertinus (secondary), self-hosted in `fonts/` (WOFF2/WOFF/TTF)
- **JS:** vanilla only, classic scripts (no modules, no `type="module"`), IIFE-wrapped, `var`-style ES5-ish so it runs from `file://` without a server
- **Seven pages**, each a standalone HTML file with an identical shared bottom `<script>` block

## Repo Layout

```
*.html              7 pages (index, projects, courses, trips, books, lifts, gates)
style.css           ~2.4k lines, the whole design system (banner-commented sections)
assets/             page JS, vendored libs, generated data, raw data, one PDF
fonts/              Latin Modern + Libertinus webfonts
images/             compressed site images, one subfolder per topic (~52 MB)
images_og/          uncompressed originals, kept as backup (~283 MB)
prism/              prism.css + prism.js — CSS linked on 6 pages, JS never loaded
lang/               19 language CSS files inherited from LaTeX.css i18n, unused
*.py                three standalone scripts (see Generators & Scripts)
test_gates_data.py  pytest invariants for the Gates data
gates-backend-spec.md  original Gates design spec (code has since diverged — see Gates)
sitemap.xml, robots.txt, CNAME, README.md
```

236 tracked files, the vast majority of them images. `.gitignore` lists `.venv/`, `.claude`, `CLAUDE.md`, `__pycache__/` — but **this file is already tracked**, so edits to it still show in `git status` (`.gitignore` only affects untracked paths).

## Local Development

No build step. Two ways to look at a change:

```bash
# 1. open the file directly — works for everything except clean-URL rewriting
firefox index.html

# 2. serve it, which is what you want for anything URL- or fetch-sensitive
python3 -m http.server 8931 --bind 127.0.0.1
```

Notes for verification work:

- Internal links deliberately keep `.html` so `file://` browsing works; the clean-URL script is skipped on `file://`
- No chromium on this machine right now (`firefox` is at `/usr/bin/firefox`; `.claude/settings.local.json` still carries allow-rules for headless chromium from earlier sessions)
- All geo/lift/gates data is loaded as JS `const`s, never `fetch`ed, precisely so `file://` works
- `assets/gates.js` can be exercised headlessly under `node` with a stub DOM (`document.getElementById` returning fake elements + a `localStorage` map) run through `vm.createContext`; `GATES_DATA` is a top-level `const`, so read it back with `vm.runInContext('GATES_DATA', ctx)`, not `ctx.GATES_DATA`
- `node --check assets/<file>.js` is the cheap syntax gate before reloading a browser

Tests (the only automated ones in the repo):

```bash
python3 -m pytest test_gates_data.py        # 5 tests: invariants, self-consistency,
                                            # id/rows, epoch set, byte-reproducibility,
                                            # and committed file == build() output
```

## Pages

Common shell on every page: `<header>` → `.abstract` → `<main><article>`, fixed left sidebar nav, shared bottom script. Bodies are `class="text-justify has-sidebar"` everywhere **except `gates.html`**, which is `class="has-sidebar"` (a game reads badly justified).

| File | Content | Page-specific JS | TOC |
|------|---------|------------------|-----|
| `index.html` | Bio, travel globe | d3 + topojson + 3 geo files + `locations.js` + `globe.js` | no |
| `projects.html` | School Projects (3), six YouTube embeds | none | yes |
| `courses.html` | Favorite Classes (5), degree Timeline gantt, Full Transcript (8 terms) | none | yes |
| `trips.html` | School (3), Personal (1), Backpacking (7) — 9 photo galleries | none | yes |
| `books.html` | Favorites, Currently Reading, All shelf | `books.js` + inline shelf renderer | no |
| `lifts.html` | Maxes & Meet Results (2 tables), Progress (5 charts) | d3 + `lifting-data.js` + `lifting.js` | no |
| `gates.html` | Gates: daily logic-gate puzzle | `gates-data.js` + `gates.js` | no |

Content details worth knowing before editing prose:

- **index** — "Last Updated" date sits in `<header>`; the email line in `.abstract` is an inline `onclick` clipboard copy that swaps its own label to "Copied!" for 1s. A **"Currently" section is commented out** in the markup. Footnote credits LaTeX.css
- **projects** — three school projects: ECE 306 autonomous car, ECE 526 MIDI Tesla coil, ECE 212 LED state-machine circuit (links `assets/ece212-lab3.pdf`). A **"Personal Projects" section (Eagle Scout) is commented out**, in both the TOC and the article
- **courses** — favorites are ECE 306, ECE 585, ECE 550, ECE 212, ES 300. Transcript runs Fall 2023 → Fall 2026 (current); a **Spring 2027 planned block is commented out** in both TOC and article. The gantt is a `<table class="gantt borders-custom">` of `bar-done` / `bar-current` / `bar-plan` cells across 5 years × 2 semesters, rows BS EE / MS EE / MS NE
- **trips** — 11 trips, 9 of them with a `.gallery` (BEIP Workshops and GE-Hitachi are prose-only)
- **books** — 31 books in `assets/books.js`: 5 `fav`, 3 `current`, 9 `format: "audio"`
- **lifts** — 5 meets in the CSV (2024-03 → 2026-07); all-time bests table is hand-written HTML, the per-meet table body is filled by JS

`experience.html` was deleted (2026-08). No dangling references remain anywhere. Don't reintroduce it.

## Key Files

### `style.css`

One file, ~2,366 lines, organized into `/* ==== */` banner sections in this order:

`FONT FACES` · `GLOBAL RESETS` · `CSS CUSTOM PROPERTIES` · `BODY` · `CODE/PRE/KBD` · `TABLES (booktabs)` · `TABLE CAPTIONS` · `CUSTOM-BORDER TABLES` · `PER-COLUMN ALIGNMENT` · `FIGURE CAPTIONS` · `HEADINGS` · `TOC NUMBERING` · `THEOREM/LEMMA/PROOF` · `SIDENOTES` · `FOOTNOTES` · `ABSTRACT BLOCK` · `THE LATEX LOGO` · `HEADING TYPOGRAPHY` · `FIXED-LEFT SIDEBAR` · `SIDEBAR narrow-screen collapse` · `TRIPS-PAGE TOC (dot leaders)` · `SIDEBAR list-counter override` · `GANTT CHART` · `DEV LOG "CONTINUED" ROW` · `BACK-TO-TOP BUTTON` · `PHOTO GALLERY GRID` · `IMAGE LIGHTBOX` · `RESPONSIVE VIDEO EMBEDS` · `READING-PROGRESS BAR` · `MOBILE-FIRST RESPONSIVE FIXES` · `PRINT STYLESHEET` · `BOOKSHELF` · `GATES`

Color flows through one place: a `--token-*` palette (`--token-orange`, `--token-lime`, `--token-red`, …) defined three times — `:root` (light), `.latex-dark` (manual dark, what the site actually uses), and `.latex-dark-auto` under `prefers-color-scheme: dark` (defined but never applied by any page). Everything downstream aliases those tokens:

- `--chart-squat/bench/deadlift/total/dots` → tokens; `--chart-grid`, `--chart-muted` for furniture
- `--gantt-done/current/plan/plan-stripe` → all `color-mix()` of `--token-red` with ink or surface, so they flip with the theme automatically
- The token palette is copied from prism.css so `gates.html` (which doesn't link prism) still resolves them

Other structural variables: `--mobile-nav-h: 2.5rem` (collapse band height), `--border-width-thin/thick` (booktabs rules), `--text-indent-size`.

Breakpoints: **500px** (globe cap) · **640px** (phone overrides) · **1025px** (sidebar collapses; 641–1025px is the tablet band) · **1050px** (sidenote collapse).

### `assets/` — page scripts

- **`globe.js`** (179 lines) — travel globe. Tunables at top: `SPIN_SPEED` (0.02 °/ms), `RESUME_DELAY` (500ms), `PIN_COLOR` (`#b00020`), `PIN_MIN_R`, `PIN_SCALE`, `BORDER_COLOR` (`#999`), `BORDER_WIDTH`, `START_VIEW` (`[95, -25]`), `EDGE_MARGIN`. Canvas + `d3.geoOrthographic().clipAngle(90)`; coastlines, 10° graticule, country borders via `topojson.mesh(..., a !== b)` (inland edges only), US state lines from Natural Earth admin-1
- **`lifting.js`** (300 lines) — five d3 SVG line charts. Tunables: `LBS_PER_KG`, `EVENTS` (dashed vertical markers; currently one, `2024-11-02 SI joint injury`), `CHART_HEIGHT` (260), `DOT_R` (4.5), `X_PAD_DAYS` (60), `Y_PAD_FRAC` (0.10). Reads series color from `--chart-<metric>` at draw time, so the theme toggle's synthetic `resize` repaints in the new palette
- **`gates.js`** (724 lines) — the whole Gates game. See the Gates section below
- **`books.js`** (63 lines) — data only; the renderer lives inline at the bottom of `books.html`

### `assets/` — vendored libraries and data

- `d3.v7.min.js` (v7.9.0), `topojson-client.min.js` (v3.1.0) — self-hosted
- `land-110m.js`, `countries-110m.js`, `us-states-110m.js` — geo data wrapped as JS `const`s (`WORLD_LAND`, `WORLD_COUNTRIES`, `US_STATE_LINES`) rather than fetched JSON, so the site works from `file://`. All carry a provenance banner except `land-110m.js`
- `locations.js` — 43 globe pins; append `{ name, lat, lon }`, ballpark coords are fine
- `books.js` — 31 books. Per entry: `slug` (cover filename), `title`, `author`, `read` (`"YYYY"` or `"YYYY-MM"`, **sort-only, never displayed**), optional `format: "audio"`, `fav: true`, `current: true` (Currently Reading, excluded from All, needs no `read`), `sortTitle`/`sortAuthor` overrides
- `nathanhattrup.csv` — raw OpenPowerlifting export (plus hand-added rows), 5 meets; the source of truth for lifting numbers
- `lifting-data.js` — **generated** from that CSV (`const LIFTING_MEETS`, kg, sorted by date, includes per-attempt arrays with misses negative)
- `gates-data.js` — **generated** puzzle list (`const GATES_DATA`, `version: 4`, 168 puzzles, ~19 KB)
- `ece212-lab3.pdf` — linked from the ECE 212 project writeup

**Book covers:** drop a jpg at `images/books/<slug>.jpg`. The header comment in `books.js` says to run `get_cover.py` — **that script is not in the repo**. Add covers by hand, or restore the script and fix the comment.

### Generators & Scripts

| Script | Writes | When to run |
|--------|--------|-------------|
| `make_lifting_data.py` | `assets/lifting-data.js` | after **every** CSV edit |
| `make_gates_data.py` | `assets/gates-data.js` | only if the Gates ruleset changes |
| `compress_images.py` | `images/` in place | after adding photos |

```bash
python3 make_lifting_data.py                # prints "Wrote N meets to ..."
python3 make_gates_data.py                  # writes the file
python3 make_gates_data.py --print          # raw JSON to stdout (what the tests diff)
python3 compress_images.py                  # defaults: quality 80, max-width 1920
python3 compress_images.py --quality 70 --verbose
python3 compress_images.py --dry-run        # preview
python3 compress_images.py --images-dir images
```

`compress_images.py` needs `pip install Pillow` (plus `pillow-heif` for HEIC — without it, the two tracked `.HEIC` files, `images/phil21/IMG_7632.HEIC` and `images/ntier/IMG_7472.HEIC`, are skipped). It compresses in place and preserves paths; `images_og/` is the untouched backup.

`make_gates_data.py` internals worth knowing before touching it:

- `GATES = [AND, NAND, OR, NOR, XOR, XNOR]`, `ROWS = [(0,0),(0,1),(1,0),(1,1)]` (MSB = A, shipped in the data so the client never hardcodes row order)
- Rules that define the space: ≤2 NOT bubbles total, no single gate with both inputs NOTted, **at most one XOR/XNOR per puzzle**, Q never constant, C ≠ D, neither branch constant. Classes are keyed on `(sorted(C, D), final gate)` so a circuit and its vertical mirror collapse into one — that yields exactly **168** classes
- `pick_representatives()` steers the gate mix toward `GATE_WEIGHTS` (AND/OR 20%, NAND/NOR 17.5%, XOR 15%, XNOR 10%) with `NOT_PENALTY = 0.2` trading extra bubbles against distribution fit. Achieved mix is best-effort (~±1 pt) because each class's final gate is fixed
- Fully deterministic: `SHUFFLE_SEED = 20260101` is frozen; one shuffle then strict in-order serving guarantees every puzzle is used once before any repeat
- `EPOCH = "2026-08-09"` is the launch date and **must NEVER change** — it remaps every past date's puzzle and corrupts stored histories and share strings
- `difficulty` is a 0–5 heuristic kept for internal balance checks only; never shown to the player

## Interactive Features

Everything below is hand-rolled vanilla JS. The first six live in the **shared bottom script** present verbatim on all seven pages — change one, change all seven.

- **Clean URLs** — `history.replaceState` strips `.html` (`/trips.html` → `/trips`, `/index.html` → `/`; search + hash preserved). Works because GitHub Pages serves `page.html` at `/page`. Skipped on `file://`
- **Dark mode toggle** — "Dark Mode"/"Light Mode" button in the sidebar (inside the mobile dropdown, at its bottom). Toggles `latex-dark` on `<body>`; stored in `localStorage.theme` as `"dark"`/`"light"`, shared across pages; default light (dark only when the key is exactly `"dark"`). Three synced pieces per page: (1) a one-line `<script>` right after `<body>` that applies the class pre-paint, (2) the `.theme-toggle` button, (3) the handler, which also dispatches a synthetic `resize` so canvas/SVG drawings (globe, lift charts) repaint in the new ink
- **Mobile nav dropdown** — at ≤1025px the sidebar becomes a slim fixed top band (`--mobile-nav-h`) with a full-width "Menu ▾" `.nav-toggle`. Tapping toggles `.nav-open` on `.sidebar` to drop the link list + theme toggle as an overlay; caret flips via `aria-expanded`; closes on outside click or Escape. Body gets mobile `padding-top` and `scroll-padding-top` so the band never hides anchors. Desktop (≥1026px) unchanged; print hides the sidebar entirely
- **Reading progress bar** — `<div class="progress-bar">` at the top, width set on scroll
- **Back-to-top button** — fixed bottom-right, `.visible` after 400px of scroll
- **Lightbox** — clicking any `.gallery img` or `article > figure img` opens a fullscreen overlay. Images inside one `.gallery` get prev/next arrows + ←/→ keys; standalone images open alone. `books.html` uses an extended version with a `.lightbox-caption` bar (title — author, audiobook tag)
- **Table scroll wrapping** — JS wraps `article table:not(.gantt)` in `.table-scroll-wrap` for horizontal scroll on phones. The `.gantt` exemption keeps the courses Timeline intact

Page-specific features:

- **Travel globe** (`index.html`) — B/W lineart canvas globe with red pins. Auto-spins 20°/s, drag to rotate (mouse + touch), spin resumes 0.5s after release, respects `prefers-reduced-motion` (no auto-spin), line color follows page text color so dark mode is automatic, hidden in print. `#globe` is capped at `max-width: 500px`
- **Bookshelf** (`books.html`) — **Favorites** then **Currently Reading** on top, both rendered by the shared `renderFixedSection(id, pick)` helper: covers + title/author/format, alphabetical by title, unaffected by the toolbar. Each section's `<h2>` and intro prose are **static HTML** inside `<div id="favorites">` / `<div id="currently-reading">` — edit them in the page; JS only appends the grid, and hides the whole div (static text included) when nothing matches. `<h2>All</h2>` is static too. Below the toolbar, `#shelf` renders the full shelf: covers/list toggle + sort by recent/title/author, clicking the active sort flips direction (`▲`/`▼`). Favorites repeat in All; `current: true` books do not (filtered out of `sortedBooks()`). State persists in `localStorage` (`booksView`, `booksKey`, `booksDir`); a `#list`/`#covers` hash overrides the view. Title sort ignores a leading "The/A/An"; author sort uses the last word of the name; both overridable per book
- **Lifting charts** (`lifts.html`) — five single-series d3 SVG charts drawn into `.liftchart[data-metric]`. Lift/total charts plot lbs with a right-hand axis relabeling the same scale in kg (exact conversion, not a second scale); DOTS is unitless. Tight y-range, hairline grid, dashed event markers (labels only on the chart carrying `data-event-labels` — currently just squat). Hover/tap gives a crosshair + tooltip (value, meet, date); arrow keys step through meets when a chart has focus. The Meet Results table body (`#meet-results-body`) is filled from the same data. Redraws on resize
- **Gates** (`gates.html`) — see below
- **Photo gallery grid** — `.gallery` renders a 2-column CSS grid (1 column on phones) with hover zoom; figure numbering suppressed inside galleries. Only `trips.html` (9 galleries)
- **Responsive video embeds** — YouTube iframes in `.video-wrap` for 16:9 scaling. Only `projects.html` (6 embeds)
- **Sidenotes (unused)** — LaTeX.css sidenote plumbing (`.sidenote`, `label.sidenote-toggle`, click-to-expand below 1050px) is fully styled but no page uses it

## Gates (`gates.html` + `assets/gates.js` + `assets/gates-data.js`)

The most intricate thing in the repo. Read `gates-backend-spec.md` before changing behavior — its §13 invariants still hold — but **the build has deliberately diverged from the spec, and where they disagree the code wins**: 168 puzzles not 200, a winning submission costs no life, gate usage is weighted, the header shows no date, the archive is disabled, and there is now a timer. The spec has not been rewritten to match.

**Gameplay.** One fixed-topology circuit per day: A/B feed two gates whose outputs are C and D, which feed a final gate producing Q. The player fills the 4-bit Q column in a tri-state table (tap cycles empty → 0 → 1), 3 lives, all-or-nothing feedback. C and D are optional scratch, revealed only once the day resolves (on a loss that reveal is the teaching moment).

**Hard rules (do not regress):**
- Daily puzzle keyed to the **local calendar date** — `localDateStr` uses local getters, never `toISOString`; `dayNumber` parses two bare `YYYY-MM-DD` strings so the timezone cancels
- Player-facing number is the unwrapped **day count**; the puzzle id (`n % 168`) stays internal
- C/D are never validated or marked, in any form
- Q feedback is one bit: correct or not — identical wording regardless of C/D
- Duplicate detection compares Q only, and costs no life
- Only wrong submissions spend a life; win, duplicate and incomplete are free
- Archive plays never touch the streak
- `EPOCH` never changes after launch

**Cycle math.** 168 puzzles, epoch 2026-08-09, `id = dayNumber % 168`. The list wraps on **2027-01-24** (day 168 → puzzle id 0) and every 168 days after; the player-facing number keeps counting ("No. 168"), and history stays keyed by date, so replays never collide. Widening the ruleset (e.g. lifting the one-XOR/XNOR cap) grows the space but reshuffles every future day's assignment — only worth doing before the wrap.

**Storage.** `localStorage["gates.v4"]` (`STORE_KEY`), every read/write wrapped in try/catch; corrupt data degrades to "new player". Shape:

```js
{
  history: { "2026-09-16": { attempts: [false, true], archive: false, ms: 84000 } },
  scratch: { date, c, d, q, tried, ms },   // today's unresolved daily only
  streak, maxStreak, lastPlayed, tutorialSeen
}
```

History is pruned to the most recent `HISTORY_LIMIT = 400` dates on write. Streak increments only when `lastPlayed` is exactly the previous calendar day.

**Timer.** `#gates-timer` sits in the `.gates-meta` line between "No. n" and How To Play. Elapsed time accumulates from wall-clock deltas (`Date.now()`), not tick counts, and displays as `m:ss` (`h:mm:ss` past an hour). It runs only while the puzzle is in front of the player — `timerRunnable()` requires a live game, the tutorial modal hidden, `!document.hidden`, and `document.hasFocus()` — so the first-run tutorial leaves it parked at 0:00 (dimmed via `.paused`). It persists as `scratch.ms` on every pause, every 10s while running, and on `pagehide`, so a refresh resumes; it freezes on resolve and is recorded as the history entry's `ms`. A day resolved before the timer existed has no `ms` → blank display and no time line in the share string.

**Share string** — checks/Xs, unwrapped day number, time on its own line, then the URL:

```
Gates #38
❌✅
⏱ 1:24

https://www.nathanhattrup.com/gates
```

Copied via `navigator.clipboard` with a hidden-textarea + `execCommand` fallback for old mobile Safari.

**Drawing.** Gate symbols come from `GATE_SHAPES` / `gateMarkup()`: real ANSI/IEEE distinctive shapes (AND D-body, OR/XOR swoosh) with a tip bubble for the N-variants — **never labeled boxes**. Strokes use `currentColor` so dark mode is free. The same helper draws the six labeled symbols injected into the tutorial's `.gates-sym` spans, so the legend can't drift from the circuit.

**Text.** All player-facing message strings live in the `STRINGS` object at the top of `gates.js` — edit freely, `{curly}` placeholders are filled by code. Tutorial/how-to-play prose is static HTML in `gates.html` (intro + one card per gate: symbol, Boolean equation, plain-English description, truth table).

**Archive is currently disabled** — commented out in `gates.html` (the `#gates-archive` block) and in `init()`. Uncomment both to restore the 10-wide puzzle-number grid and `?date=YYYY-MM-DD` replay of any `[epoch, today]` date.

## Domain, Hosting, DNS

Durable deployment facts, worth not rediscovering:

- **Repo → Pages:** project repo `nathanhattrup/nathanhattrup.com`, `CNAME` of `www.nathanhattrup.com`. `nathanhattrup.github.io/nathanhattrup.com/*` returns `301` to the custom domain — that redirect is the healthy signal, not an error
- **DNS:** GoDaddy nameservers (`ns55`/`ns56.domaincontrol.com`). Apex has GitHub Pages A records (`185.199.108-111.153`); `www` is a CNAME to `nathanhattrup.github.io`
- **Mail posture (domain sends no mail):** `TXT @ v=spf1 -all`, null MX (`0 .`, RFC 7505), `_dmarc` at `v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:nahattrup@gmail.com`. The `rua` target is a Gmail address on a different domain and Gmail publishes no RFC 7489 §7.1 authorization record, so aggregate reports will not arrive — expected, not a fault. `p=reject` is unaffected
- **CAA:** `0 issue "letsencrypt.org"` + `0 issuewild ";"`. GitHub Pages uses Let's Encrypt, so this is safe today. **This record will break a host migration** — update it before moving to any provider using a different CA
- **DNSSEC:** enabled (DS at the registry, DNSKEY published, answers validate)
- **Google Search Console:** verified as a *Domain* property via the `google-site-verification=` TXT record on the apex. **Never delete that TXT record**
- **Known issue — CUJO AI / Spectrum block.** Since 2026-08-09 the domain is blocked at the SNI layer by CUJO AI (the engine inside Spectrum's Security Shield) on some consumer ISP networks. Symptom is a bogus TLS error (`SSL received a record that exceeded the maximum permissible length`, or curl's `wrong version number`) because the filter answers the TLS ClientHello with a plaintext HTTP redirect to `block.charter-prod.hosted.cujo.io`. **Not a site defect, and no page content can fix it** — the filter never fetches a byte of HTML; it scores domain reputation off-page. Practical consequence: you may be unable to load the live site locally. Verify deploys via `nathanhattrup.github.io/nathanhattrup.com/`, a VPN, or cellular

**SEO plumbing:** `sitemap.xml` lists all 7 clean extensionless URLs; `robots.txt` allows everything and points at the sitemap. Every page head carries `<title>`, a unique `<meta name="description">`, `rel="canonical"` with the clean URL, and three favicon links.

**Favicon** (`images/favicon/`) — `favicon.svg` is the source of truth ("NH" from LM-bold.ttf converted to paths + a red rule; ink flips via a `prefers-color-scheme` media query inside the SVG), plus `favicon-32.png` and `apple-touch-icon.png` (180px, white bg). All 7 heads link all three. To change the design: edit/regenerate the SVG, then re-rasterize the PNGs from it — render at 8× in a headless browser and downscale with Pillow, **rasterizing from a copy with the dark-mode media query stripped** (headless browsers may otherwise render the dark variant).

## Vault Sync

When asked to "update my vault with current website content" (or similar), export page prose to Nat's Obsidian vault as markdown. Read `/mnt/windows/Users/nahat/Documents/VAULT/CLAUDE.md` first (vault rules; external-project writes go to `VAULT/claude/`).

- **Targets:** `index.html` → `Home.md`, `courses.html` → `Courses.md`, `projects.html` → `Projects.md`, `trips.html` → `Trips.md`, `lifts.html` → `Lifts.md`. Skip `books.html`, and skip `gates.html` (a game — its text is UI chrome and tutorial copy, not writing)
- **Overwrite** the existing files in `VAULT/claude/` — full re-export, not a diff. If Nat has promoted a note out of `claude/` (check `fd -e md <name>` in the vault), update it in place instead of recreating it in `claude/`
- **Capture:** written text, headings, and tables only. Convert HTML tables to markdown tables; summarize the courses gantt as a small text table. Keep footnotes
- **Images/videos:** don't copy. Note them in `> [!note]` callouts — galleries as one callout summarizing captions with the folder path (e.g. `images/japan/`), standalone images with caption + path, YouTube embeds as plain links
- **Links:** cross-page site links become `[[wikilinks]]` (e.g. `[[Trips]]`); external links stay markdown links
- **Style:** each note starts with `# Title` and an *"Imported from nathanhattrup.com <file>"* line. Fix obvious typos in transcribed prose; **never edit the HTML**. Omit site chrome (sidebar nav, TOC dotfill, lightbox/JS). Skip commented-out sections — they aren't published content

## Conventions

- Semantic HTML5 throughout (`<article>`, `<figure>`, `<figcaption>`, `<aside>`)
- TOC uses `nav.toc-dotfill` with dot-leader styling — only on `courses`, `projects`, `trips`
- Current page marked `aria-current="page"` in the sidebar nav
- **All shared JS is inline at the bottom of each HTML file — keep all seven copies in sync.** Same for the sidebar nav markup and the pre-paint theme `<script>`
- Every page head carries title, unique description, canonical link, three favicons
- Generated files (`gates-data.js`, `lifting-data.js`) carry a "GENERATED FILE — do not edit by hand" banner; edit the generator or the CSV instead
- Tunable constants live in a commented block at the top of each JS file rather than scattered inline
- Print stylesheet hides sidebar, lightbox, progress bar, back-to-top, and globe; shows link URLs inline

## Dead Weight & Gotchas

Known-inert things, so they aren't mistaken for live wiring:

- **`prism/prism.js` is never loaded.** `prism/prism.css` is linked on 6 pages (everything but `gates.html`) and no page has a highlighted code block. Either wire up the JS or drop both if a page ever needs real syntax highlighting. Note the `--token-*` palette is mirrored into `style.css`, so dropping prism.css does not break the charts
- **`lang/`** — 19 language CSS files from LaTeX.css i18n, referenced by nothing
- **`.dev-log-continued`** — CSS for a dev-log table that no longer exists in any page
- **`body.libertinus`** and **`.latex-dark-auto`** — styled opt-ins no page sets
- **Sidenotes** — fully styled, entirely unused
- **`get_cover.py`** — referenced by the `books.js` header comment, absent from the repo
- **Two `.HEIC` files** under `images/ntier/` and `images/phil21/` that `compress_images.py` skips unless `pillow-heif` is installed
- **Commented-out content** lives in `index.html` ("Currently"), `projects.html` ("Personal Projects"), `courses.html` ("Spring 2027"), and `gates.html` (archive). Don't describe any of it as live
- **`images_og/` is ~283 MB** against `images/`'s ~52 MB — both are tracked, so the repo is heavy; don't add more originals casually
