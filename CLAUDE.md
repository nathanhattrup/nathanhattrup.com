# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal portfolio site for nathanhattrup.com. Zero-build HTML/CSS/JS — no bundler, no package manager, no framework. Hosted on GitHub Pages (see `CNAME`).

## Architecture

- **CSS base:** [LaTeX.css](https://github.com/vincentdoerig/latex-css) — academic/scientific document aesthetic with light/dark mode support
- **Layout:** Fixed left sidebar nav on desktop. On mobile (≤1025px) it becomes a slim fixed top band (`.nav-toggle` "Menu" button, `--mobile-nav-h` tall) that persists on scroll; tapping it drops down the nav list + theme toggle (`.nav-open` class on `.sidebar`, handler in the shared bottom script — closes on outside click/Escape). Pages use `has-sidebar` body class + `.content` wrapper
- **Fonts:** Latin Modern (primary) and Libertinus (secondary), self-hosted in `fonts/` (WOFF2/WOFF/TTF)
- **Syntax highlighting:** Prism.js v1.21.0 (`prism/` directory)
- **JS:** Vanilla JS only — lightbox, back-to-top, progress bar, table scroll wrapping. No framework

## Pages

All pages follow same structure: `<header>` → `.abstract` → `nav.toc-dotfill` → `<main><article>`. Sidebar nav links between pages.

| File | Content |
|------|---------|
| `index.html` | Bio, site overview, dev log, personal stats, travel globe |
| `courses.html` | Favorite classes, full transcript by semester |
| `projects.html` | School and personal engineering projects |
| `experience.html` | Internship summaries (placeholder) |
| `trips.html` | School trips and backpacking photo galleries |
| `books.html` | Bookshelf: cover grid / list toggle, sortable by recency/title/author |
| `lifts.html` | Powerlifting: meet maxes, progress charts (S/B/D/Total/DOTS), meet results table |

**Note:** Projects and Experience pages are still WIP — structure exists but content is incomplete. Lifting is WIP: not yet linked from other pages' sidebars or the sitemap.

## Key Files

- `style.css` — Main stylesheet, extends LaTeX.css
- `assets/globe.js` — Travel globe rendering (tunable constants at top of file: spin speed, pin size/color, border color/width, resume delay)
- `assets/locations.js` — Globe pin data; to add a visited place, append `{ name, lat, lon }` (ballpark coords fine)
- `assets/d3.v7.min.js`, `assets/topojson-client.min.js`, `assets/land-110m.js`, `assets/countries-110m.js`, `assets/us-states-110m.js` — Self-hosted globe dependencies; all geo data (coastlines, country polygons, US state lines) is wrapped as JS `const`s (not fetched JSON) so the site still works when opened via `file://`
- `assets/books.js` — Bookshelf data; each entry: `slug` (cover filename), `title`, `author`, `read` ("YYYY" or "YYYY-MM", internal sort only, never displayed), optional `format: "audio"`, optional `fav: true` (Favorites section), optional `current: true` (Currently Reading section; excluded from the All shelf, no `read` date needed), optional `sortTitle`/`sortAuthor` overrides
- `get_cover.py` — Downloads a book cover from Open Library into `images/books/<slug>.jpg` (`python3 get_cover.py "Title" "Author" slug`); if Open Library has no scan, drop any jpg there manually
- `assets/nathanhattrup.csv` — Raw OpenPowerlifting export (plus manually added rows) feeding the lifting charts; `assets/lifting-data.js` is generated from it by `python3 make_lifting_data.py` (rerun after every CSV update)
- `assets/lifting.js` — Lifting chart rendering (tunables at top: event markers, chart height, dot radius, axis padding); series colors are the `--chart-*` CSS variables in `style.css` (per-mode values validated for contrast in light and dark)
- `compress_images.py` — Image optimization script (requires `pip install Pillow`)
- `images/favicon/` — Site icon: `favicon.svg` (source of truth; "NH" from LM-bold.ttf converted to paths + red rule, ink flips via `prefers-color-scheme` media query inside the SVG), `favicon-32.png` fallback, `apple-touch-icon.png` (180px, white bg). All 6 heads link all three. To change the design, edit/regenerate the SVG then re-rasterize the PNGs from it (render at 8x scale in headless chromium, downscale with Pillow — rasterize from a copy with the dark-mode media query stripped, headless chromium may render dark)
- `sitemap.xml` / `robots.txt` — SEO plumbing; sitemap lists clean extensionless URLs, excludes WIP pages (add `experience` when it gets real content). Each page head also carries a `rel="canonical"` link with its clean URL
- `images/` — Compressed site images, organized by topic subfolder
- `images_og/` — Original uncompressed image backups
- `lang/` — 23 language CSS files for LaTeX.css i18n (not actively used)

## Image Compression

Run from repo root:
```bash
python3 compress_images.py                  # defaults: quality 80, max-width 1920px
python3 compress_images.py --quality 70 --verbose
python3 compress_images.py --dry-run        # preview without changes
```

## Interactive Features

- **Dark mode toggle** — "Dark Mode"/"Light Mode" button in the sidebar nav (below the page list; inside the mobile dropdown, centered at its bottom). Toggles `latex-dark` class on `<body>`; preference stored in `localStorage.theme` (`"dark"`/`"light"`), shared across all pages. Default is light — dark only when the key is exactly `"dark"`. Three synced pieces on every page: (1) a one-line `<script>` right after `<body>` applies the class pre-paint (no flash), (2) the `.theme-toggle` button in the sidebar, (3) the toggle handler in the shared bottom script (also fires a synthetic `resize` event so the globe canvas redraws in the new ink color). Button styles in `style.css` next to the sidebar rules.
- **Mobile nav dropdown** — On ≤1025px the sidebar becomes a slim fixed band at the top of the viewport (persists on scroll): a single full-width "Menu ▾" `.nav-toggle` button, `--mobile-nav-h` (2.5rem) tall, page bg + thin bottom border. Tapping toggles `.nav-open` on `.sidebar`, revealing the `<nav>` as a dropdown overlay: vertical centered link list (numbering suppressed), theme toggle at bottom; caret flips ▾/▴ via `aria-expanded`. Closes on outside click or Escape. Handler is an IIFE in the shared bottom script (keep in sync across pages, like the theme toggle); styles live in the `@media (max-width: 1025px)` sidebar block in `style.css`. Body gets mobile `padding-top` to clear the band and `scroll-padding-top` so anchor jumps aren't hidden. Desktop (≥1026px) unchanged — `.nav-toggle` is `display: none` there, and print hides the whole sidebar.
- **Clean URLs** — snippet in the shared bottom script strips `.html` from the address bar via `history.replaceState` (`/trips.html` → `/trips`, `/index.html` → `/`; search + hash preserved). Works because GitHub Pages serves `page.html` at `/page` natively. Skipped on `file://` — internal links deliberately keep `.html` so local file testing works.
- **Travel globe** (`index.html` Travel section) — B/W lineart canvas globe (d3-geo orthographic projection, coastlines + graticule, gray country borders + US state lines) with red pins for visited places. Country borders come from `topojson.mesh` with an `a !== b` filter (inland edges only); US state lines are Natural Earth 110m admin-1, US-filtered. Auto-spins at 20°/s, drag to rotate (mouse/touch), spin resumes 0.5s after release. Respects `prefers-reduced-motion` (no auto-spin). Line color follows page text color so dark mode works automatically. Hidden in print. Pin data lives in `assets/locations.js`.
- **Bookshelf** (`books.html`) — Two optional fixed sections on top, above the sort toolbar: **Favorites** (`fav: true` in `books.js`) then **Currently Reading** (`current: true`). Both use the same design — covers + title/author/format text, alphabetical by title, rendered once at load, unaffected by the toolbar — via the shared `renderFixedSection(id, pick)` helper. Each section's `<h2>` and intro text are **static HTML inside `<div id="favorites">` / `<div id="currently-reading">`** — edit them directly in the page; JS appends only the covers grid, and hides the whole div (static text included) when no book matches. The `<h2>All</h2>` above the toolbar is static HTML too. Below the toolbar the full shelf (favorites repeat here; `current: true` books do **not** — they're filtered out of `sortedBooks()` and live only in Currently Reading): cover-grid/list toggle + sort by recent/title/author (asc/desc, click active sort again to flip). State persists in localStorage; `#list`/`#covers` URL hash overrides view. Clicking a book opens the lightbox with a caption bar (title — author, audiobook tag). Title sort ignores leading "The/A/An"; author sort uses last name. Rendering is all client-side from `assets/books.js`. Dark-mode button styles are scoped to `.latex-dark`/`.latex-dark-auto` (used by the site-wide dark mode toggle).
- **Lifting charts** (`lifts.html` Progress section) — five separate d3 SVG line charts (squat/bench/deadlift/total/DOTS), one series each, drawn into `.liftchart[data-metric]` divs from `assets/lifting-data.js` (kg; generated from the CSV). Lift/total charts plot in lbs with a right-hand axis relabeling the same scale in kg (exact conversion, not a second scale); DOTS is unitless. Tight y-range, hairline grid, dashed vertical event markers (dates/labels in the `EVENTS` array at the top of `lifting.js`; labels drawn only on the chart with `data-event-labels`). Hover/tap shows a crosshair + tooltip (value, meet, date); arrow keys step through meets when a chart is focused. A Meet Results table below carries every charted value (tbody filled by JS into `#meet-results-body`). Redraws on resize; theme toggle's synthetic resize re-reads the `--chart-*` colors for dark mode.
- **Lightbox with gallery nav** — clicking any image opens fullscreen overlay. Images inside a `.gallery` div get per-gallery prev/next arrows + keyboard left/right navigation. Standalone images open without arrows.
- **Photo gallery grid** — trip photos wrapped in `<div class="gallery">` render as 2-column CSS grid (1-column on mobile) with hover zoom. Figure numbering suppressed inside galleries.
- **Reading progress bar** — `<div class="progress-bar">` at top of each page, width updated on scroll via JS.
- **Back-to-top button** — fixed bottom-right, appears after 400px scroll.
- **Responsive video embeds** — YouTube iframes wrapped in `<div class="video-wrap">` for 16:9 aspect-ratio scaling.
- **Table scroll wrapping** — JS auto-wraps `article table:not(.gantt)` in `.table-scroll-wrap` for mobile horizontal scroll.

## Vault Sync

When asked to "update my vault with current website content" (or similar), export page prose to Nat's Obsidian vault as markdown. Read `/mnt/windows/Users/nahat/Documents/VAULT/CLAUDE.md` first (vault rules; external-project writes go to `VAULT/claude/`).

- **Targets:** `index.html` → `Home.md`, `courses.html` → `Courses.md`, `projects.html` → `Projects.md`, `trips.html` → `Trips.md`. Skip `books.html` and any page with placeholder/empty content (e.g. `experience.html` while WIP). If a skipped page has gained real content, export it too (capitalized filename matching page title).
- **Overwrite** the existing files in `VAULT/claude/` — full re-export, not a diff. If Nat has promoted a note out of `claude/` (check `fd -e md <name>` in vault), update it in place instead of recreating in `claude/`.
- **Capture:** written text, headings, and tables only. Convert HTML tables to markdown tables; summarize the courses gantt chart as a small text table. Keep footnotes.
- **Images/videos:** don't copy. Note them in `> [!note]` callouts — galleries as one callout summarizing captions with the folder path (e.g. `images/japan/`), standalone images with caption + path, YouTube embeds as plain links.
- **Links:** cross-page site links become `[[wikilinks]]` (e.g. `[[Trips]]`); external links stay markdown links.
- **Style:** each note starts with `# Title` and an *"Imported from nathanhattrup.com <file>"* line. Fix obvious typos in transcribed prose; never edit the HTML. Omit site chrome (sidebar nav, TOC dotfill, lightbox/JS).

## Conventions

- Semantic HTML5 elements throughout (`<article>`, `<figure>`, `<figcaption>`, `<aside>`)
- TOC uses `nav.toc-dotfill` with dot-leader styling
- Current page marked with `aria-current="page"` in sidebar nav
- All shared JS (lightbox, progress bar, back-to-top, table wrap) is inline in `<script>` at bottom of each HTML file — keep in sync across pages when modifying
- Mobile breakpoints: 640px (small), 1025px (medium/sidebar collapse)
- Print stylesheet hides sidebar, lightbox, progress bar, back-to-top; shows link URLs inline
- No build step — edit HTML/CSS directly and open in browser to test
