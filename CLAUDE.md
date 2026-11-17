# CLAUDE.md — project guide

## Purpose
Premium, mobile-first sports e-commerce prototype for **SMADI** (hand mark logo) that feels like an award-site
campaign and a real store at once. Real product photos (background removed) and real media only — **no 3D models**
(the owner rejected the procedural/"comic" look).

## Non-negotiable visual rules
- Page is predominantly **bright** (`#FAFAF7`, white, stone, ink `#171A18`); cinematic dark media lives only inside
  the hero, category headers and image cards. Never a dark/neon site overall.
- Effects language: animated holographic conic borders (`.holo-border`, `.holo-ring`), `.btn-holo`, `.holo-text`,
  frosted `.glass`, film grain, cursor spotlight, `[data-reveal]` scroll reveals. Use these, don't invent new gradients.
- Type: Unbounded (display, uppercase, heavy), Sora (body), Geist Mono (labels). No Inter/Arial.
  Unbounded is very wide — size giant words with container units (`cqw`) and check at 375px.
- The sport word is composition (behind objects, on walls, on pool floors), not a caption.

## Architecture
- `src/app` routes (Server Components by default). Client islands only for canvases, gestures, stores.
- `src/data` catalogue → validated by Zod in `src/lib/catalog.ts` (`server-only`). Never hardcode product facts in components.
- Product images: `/products/<slug>-1.webp` (hero) and `-2.webp` (second view) via `renderUrl()` in `src/lib/format.ts`.
- Hero/category media and video slots: `src/config/hero.ts` (drop MP4s in `public/media/`).
- `src/stores` Zustand (cart stores ids/variants/qty only; prices come from `POST /api/cart/quote`).
- `scripts/build-catalog.mjs` builds the catalogue + cut-outs from `media-src/raw/*.json`; `scripts/cutout-rembg.py` re-cuts hard backgrounds.

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run test:e2e` · `npm run catalog` · `npm run cutout`

## Quality standards
- Typecheck, lint and Playwright must pass before committing.
- Inspect real output (screenshots via `scripts/qa-shots.mjs` or the browser pane) — compiling is not enough.
- Respect `prefers-reduced-motion`; swipe is never the only control; videos always have a still poster.
- Animation state lives in refs/CSS variables, never React state per frame.

## Security restrictions
- No secrets in the repo; `.env.example` only. Never trust client prices/quantities; validate with Zod.
- No `dangerouslySetInnerHTML`, no remote scripts/hotlinked assets, no payment handling, no permission bypasses.
- Keep CSP/headers in `next.config.ts` in sync with any new asset origins (see `SECURITY.md`).
