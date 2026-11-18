# SMADI — immersive sports store (prototype)

A mobile-first sports equipment store presented like a cinematic campaign, in a bright, white-led studio look.
A holographic loader (SMADI hand mark, live counter) splits open, and the hand mark flies into the header.
The hero then plays four **coded films**: real product cut-outs choreographed in canvas 2D, with no video files and no 3D.
- **Football:** the strike, through turf.
- **Boxing:** the hook, with sweat in slow motion.
- **Swimming:** the dive and splash.
- **Basketball:** the bounce, with a floor reflection.

Each film uses camera moves, shake, slow-motion impacts, closed-form particle physics, light shafts and specular sweeps. A giant white embossed sport word rolls behind the product.

Below the hero:
- glossy holo liquid that drips with real gooey merging and specular lighting
- official brand logos
- "Choose your arena" cards that light up with the campaign photo
- tilt plates and best sellers
- the full shopping flow, with a **demonstration** checkout

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
| `npm run catalog` | Rebuilds `public/products/*.webp` + `src/data/products/generated.json` from `media-src/raw/*.json` |
| `npm run cutout` | AI background removal (rembg) for photos the simple key cannot cut. It needs the local venv; see below |

The end-to-end suite runs against a production build:

```bash
npm run build
npx next start -p 3100
```

```bash
E2E_BASE_URL=http://localhost:3100 npm run test:e2e
```

## The hero films

Each film lives in `src/components/hero/cinema/scenes.ts` as a pure function of time, so any frame can be scrubbed.
The projector is `Cinema.tsx` and the toolkit is `core.ts`; slides are listed in `src/config/hero.ts`.
In development, set `window.__heroT = 0.7` in the console to freeze a frame.
`node scripts/film-frames.mjs --out=dir` renders frame strips of all four films for review.

## Adding your own products

Product data is validated by Zod (`src/lib/validation/catalog.ts`). Add entries to the catalogue, or replace
`generated.json`, and put cut-out photos in `public/products/<slug>-1.webp` (and `-2.webp` for a second view).

AI cut-outs use a local Python venv:

```bash
py -3 -m venv .venv-tools
```

```bash
.venv-tools/Scripts/pip install --only-binary=:all: rembg onnxruntime pillow
```

```bash
.venv-tools/Scripts/python scripts/cutout-rembg.py
```

## What's inside

- **Hero** (`src/components/hero/*`, `src/config/hero.ts`): coded canvas films, whip-pan cuts, word reel, viewfinder + timecode,
  autoplay chapter bars, swipe (direction-locked, vertical scroll stays native), arrows, keys, pointer parallax, scroll zoom.
- **Effects** (`src/app/globals.css`, `src/components/layout/Effects.tsx`): holographic conic borders, holo buttons and text,
  frosted glass, film grain, cursor spotlight, scroll reveals.
- **Header**: a floating glass pill with an animated holo glow. It follows on scroll and tightens; the bag count pops.
- **Categories** `/[sport]`, `/[sport]/[sub]`: campaign header, sub-category tiles, URL-synced filters and sort,
  burst reveal, and lit showroom walls on `/football/boots`, `/boxing/gloves` and `/swimming/goggles` (hover spotlight, zoom into the product).
- **Product** `/product/[slug]`: floating photo stage (tilt, swipe between photos, tap to zoom), scroll chapters,
  drop-into-bag tray, fly-to-bag, sticky purchase bar, recommendations.
- **Commerce**: cart drawer + `/cart`, `POST /api/cart/quote` (server pricing), `/search`, `/wishlist`,
  recently viewed, `/checkout` (demonstration only — no payments).

## Honest status

- 129 example products from 8 brands are listed, with official product photos and list prices from the brands' own stores.
  They exist to fill the demo; replace them with your own products, prices and photos before launch. See `ASSET_MANIFEST.md`.
- The category card photos are AI-generated stills supplied by the owner. The hero needs no video: its films are code.
- No payment provider is integrated; the checkout is clearly labelled as a demonstration.

Docs: `CLAUDE.md`, `DECISIONS.md`, `RESEARCH.md`, `SECURITY.md`, `ASSET_MANIFEST.md`, `VIDEO_PROMPTS.md`.
