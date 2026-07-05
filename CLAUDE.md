# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static personal portfolio site for nathanhattrup.com. Zero-build HTML/CSS/JS — no bundler, no package manager, no framework. Hosted on GitHub Pages (see `CNAME`).

## Architecture

- **CSS base:** [LaTeX.css](https://github.com/vincentdoerig/latex-css) — academic/scientific document aesthetic with light/dark mode support
- **Layout:** Fixed left sidebar nav on desktop, collapses to top bar on mobile. Pages use `has-sidebar` body class + `.content` wrapper
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

**Note:** Projects and Experience pages are still WIP — structure exists but content is incomplete.

## Key Files

- `style.css` — Main stylesheet, extends LaTeX.css
- `assets/globe.js` — Travel globe rendering (tunable constants at top of file: spin speed, pin size/color, border color/width, resume delay)
- `assets/locations.js` — Globe pin data; to add a visited place, append `{ name, lat, lon }` (ballpark coords fine)
- `assets/d3.v7.min.js`, `assets/topojson-client.min.js`, `assets/land-110m.js`, `assets/countries-110m.js`, `assets/us-states-110m.js` — Self-hosted globe dependencies; all geo data (coastlines, country polygons, US state lines) is wrapped as JS `const`s (not fetched JSON) so the site still works when opened via `file://`
- `assets/books.js` — Bookshelf data; each entry: `slug` (cover filename), `title`, `author`, `read` ("YYYY" or "YYYY-MM", internal sort only, never displayed), optional `format: "audio"`, optional `sortTitle`/`sortAuthor` overrides
- `get_cover.py` — Downloads a book cover from Open Library into `images/books/<slug>.jpg` (`python3 get_cover.py "Title" "Author" slug`); if Open Library has no scan, drop any jpg there manually
- `compress_images.py` — Image optimization script (requires `pip install Pillow`)
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

- **Travel globe** (`index.html` Travel section) — B/W lineart canvas globe (d3-geo orthographic projection, coastlines + graticule, gray country borders + US state lines) with red pins for visited places. Country borders come from `topojson.mesh` with an `a !== b` filter (inland edges only); US state lines are Natural Earth 110m admin-1, US-filtered. Auto-spins at 20°/s, drag to rotate (mouse/touch), spin resumes 0.5s after release. Respects `prefers-reduced-motion` (no auto-spin). Line color follows page text color so dark mode works automatically. Hidden in print. Pin data lives in `assets/locations.js`.
- **Bookshelf** (`books.html`) — Optional Favorites section on top, above the sort toolbar (books with `fav: true` in `books.js`; fixed design: covers + title/author/format text, alphabetical, rendered once at load). The Favorites `<h2>` and intro text are **static HTML inside `<div id="favorites">`** — edit them directly in the page; JS appends the covers grid and the "All" `<h2>` after them, and hides the whole div (static text included) when no book has `fav: true`. Below the toolbar the full shelf (favorites repeat): cover-grid/list toggle + sort by recent/title/author (asc/desc, click active sort again to flip). State persists in localStorage; `#list`/`#covers` URL hash overrides view. Clicking a book opens the lightbox with a caption bar (title — author, audiobook tag). Title sort ignores leading "The/A/An"; author sort uses last name. Rendering is all client-side from `assets/books.js`. Dark-mode button styles are scoped to `.latex-dark`/`.latex-dark-auto` (site currently ships light-only).
- **Lightbox with gallery nav** — clicking any image opens fullscreen overlay. Images inside a `.gallery` div get per-gallery prev/next arrows + keyboard left/right navigation. Standalone images open without arrows.
- **Photo gallery grid** — trip photos wrapped in `<div class="gallery">` render as 2-column CSS grid (1-column on mobile) with hover zoom. Figure numbering suppressed inside galleries.
- **Reading progress bar** — `<div class="progress-bar">` at top of each page, width updated on scroll via JS.
- **Back-to-top button** — fixed bottom-right, appears after 400px scroll.
- **Responsive video embeds** — YouTube iframes wrapped in `<div class="video-wrap">` for 16:9 aspect-ratio scaling.
- **Table scroll wrapping** — JS auto-wraps `article table:not(.gantt)` in `.table-scroll-wrap` for mobile horizontal scroll.

## Conventions

- Semantic HTML5 elements throughout (`<article>`, `<figure>`, `<figcaption>`, `<aside>`)
- TOC uses `nav.toc-dotfill` with dot-leader styling
- Current page marked with `aria-current="page"` in sidebar nav
- All shared JS (lightbox, progress bar, back-to-top, table wrap) is inline in `<script>` at bottom of each HTML file — keep in sync across pages when modifying
- Mobile breakpoints: 640px (small), 1025px (medium/sidebar collapse)
- Print stylesheet hides sidebar, lightbox, progress bar, back-to-top; shows link URLs inline
- No build step — edit HTML/CSS directly and open in browser to test
