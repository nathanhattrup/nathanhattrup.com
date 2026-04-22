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
| `index.html` | Bio, site overview, dev log, personal stats |
| `courses.html` | Favorite classes, full transcript by semester |
| `projects.html` | School and personal engineering projects |
| `experience.html` | Internship summaries (placeholder) |
| `trips.html` | School trips and backpacking photo galleries |

**Note:** Projects and Experience pages are still WIP — structure exists but content is incomplete.

## Key Files

- `style.css` — Main stylesheet, extends LaTeX.css
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
