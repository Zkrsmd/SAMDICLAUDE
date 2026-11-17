# SMADI — immersive sports store (prototype)

A mobile-first sports equipment store presented like a cinematic campaign. A holographic loader
(SMADI hand mark, live counter) splits open and fog clears over a full-bleed hero. The hero has three
sports (football, boxing, swimming) on real media: AI video when supplied, campaign stills until
then. Slides change with slanted wipes and light sweeps, the sport word slams in letter by letter, and
the real product floats in front.

Below the hero: a glossy-ink drip, the official brand logos, "Choose your arena" sport worlds, a lit
showroom wall, product pages with a floating photo stage, and a full shopping flow. The flow has a
server-priced cart, search, filters, wishlist and a **demonstration** checkout.

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

## Adding the hero videos

1. Copy the generated clips (see `VIDEO_PROMPTS.md`) into `public/media/`, e.g. `football-strike.mp4`.
2. Set `video` (and optionally `videoMobile`) for the slide in `src/config/hero.ts`.

The still `poster` stays as the first frame and as the fallback. Category cards read `categoryMedia` in the same file.

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

- **Hero** (`src/components/hero/*`, `src/config/hero.ts`): media layers, clip-path wipes, autoplay chapter bars,
  swipe (direction-locked, vertical scroll stays native), arrows, keys, pointer parallax, scroll zoom.
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
- The hero and category media are AI-generated stills supplied by the owner. The hero videos are pending.
- No payment provider is integrated; the checkout is clearly labelled as a demonstration.

Docs: `CLAUDE.md`, `DECISIONS.md`, `RESEARCH.md`, `SECURITY.md`, `ASSET_MANIFEST.md`, `VIDEO_PROMPTS.md`.
