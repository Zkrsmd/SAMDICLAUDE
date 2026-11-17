# CLAUDE.md — project guide

## Purpose
Premium, mobile-first sports e-commerce prototype ("YOUR BRAND" placeholder) that feels like a cinematic
campaign, an interactive 3D showroom and a real store at once.

## Non-negotiable visual rules
- Predominantly **bright**: `#FAFAF7` bg, white, stone `#EFEEE8`, ink `#171A18`. Never a dark/neon site.
- Sport accents appear as light/material (grass, gold, water), not as coloured boxes.
- Type: Big Shoulders (display, uppercase), Instrument Sans (body), Geist Mono (labels). No Inter/Arial.
- Sharp 2px corners, hairlines, placards. Avoid repeated identical rounded cards and random gradients.
- The sport word is composition (behind objects, on walls, on pool floors), not a caption.

## Architecture
- `src/app` routes (Server Components by default). Client islands only for canvases, gestures, stores.
- `src/data` catalogue → validated by Zod in `src/lib/catalog.ts` (`server-only`). Never hardcode product facts in components.
- `src/three/products` procedural representative models; `registry.ts` is the single swap point for licensed models.
- `src/three/hero` imperative hero engine hosted in R3F (`useFrame` priority 1 renders through `postprocessing`).
- `src/stores` Zustand (cart stores ids/variants/qty only; prices come from `POST /api/cart/quote`).
- `scripts/render-products.mjs` generates `public/renders/*.webp` from the models (dev server must run).

## Commands
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm run test:e2e` · `npm run renders`

## Quality standards
- Typecheck, lint and Playwright must pass before committing.
- Inspect real output (screenshots via `scripts/qa-shots.mjs` or the browser pane) — compiling is not enough.
- Respect `prefers-reduced-motion`; every 3D path has a non-3D fallback; swipe is never the only control.
- Animation state lives in refs, never React state per frame. Dispose geometries/materials on unmount.

## Security restrictions
- No secrets in the repo; `.env.example` only. Never trust client prices/quantities; validate with Zod.
- No `dangerouslySetInnerHTML`, no remote scripts/hotlinked assets, no payment handling, no permission bypasses.
- Keep CSP/headers in `next.config.ts` in sync with any new asset origins (see `SECURITY.md`).
