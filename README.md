# YOUR BRAND — immersive sports store (prototype)

A mobile-first sports equipment store presented like a cinematic campaign: a loader that dives
through fog into three swipeable real-time 3D hero scenes (football, boxing, swimming), sport
"worlds" for every category, a 3D showroom wall, an interactive 3D product viewer, and a full
shopping flow with server-priced cart, search, filters, wishlist and a **demonstration** checkout.

> The brand name is a placeholder. Change it in `src/config/brand.ts`.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server (Turbopack) on port 3000 |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript strict check |
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npm run test:e2e` | Playwright journeys (uses installed Microsoft Edge — no browser download) |
| `npm run renders` | Regenerates product images from the procedural 3D models (needs `npm run dev` running) |

Run the end-to-end suite against a production build:

```bash
npm run build
npx next start -p 3100
```

```bash
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

## What's inside

- **Hero** (`src/three/hero/*`, `src/components/hero/*`): one R3F canvas hosting an imperative engine
  (frame-precise choreography + post-processing). Fog-dive intro, three scenes, particle-swarm transitions,
  swipe/drag/keys/dots, scroll-driven camera, quality tiers with runtime degrade, poster fallback.
- **Homepage**: drip transition (grass / molten gold / water), brand word-marks, sport worlds, icons, best sellers.
- **Categories** `/[sport]`, `/[sport]/[sub]`: world header, sub-category tiles, URL-synced filters & sort,
  burst reveal, 3D showrooms on `/football/boots`, `/boxing/gloves`, `/swimming/goggles`.
- **Product** `/product/[slug]`: 3D viewer (orbit, presets, inspect mode, live colour), scroll chapters,
  drop-into-bag tray, sticky purchase bar, complete-your-kit, bundle, best sellers, floating collection.
- **Commerce**: cart drawer + `/cart`, `POST /api/cart/quote` (server pricing), `/search`, `/wishlist`,
  recently viewed, `/checkout` (demonstration only — no payments).

## Honest status

- 3D products and athletes are **representative procedural models**, not official manufacturer assets.
  See `ASSET_MANIFEST.md`. Swap in licensed models via `src/three/products/registry.ts`.
- Only the researched flagship products are marked verified (see `RESEARCH.md`); other listings are demo data.
- No payment provider is integrated; the checkout is clearly labelled as a demonstration.

Docs: `CLAUDE.md`, `DECISIONS.md`, `RESEARCH.md`, `SECURITY.md`, `ASSET_MANIFEST.md`.
