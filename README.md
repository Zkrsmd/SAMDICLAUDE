# SMADI — immersive sports store (prototype)

A mobile-first sports equipment store with an award-site opening, inspired by igloo.inc and lusion.co and made for SMADI.

**The opening.** The chrome hand mark loads, then flies into the header as the panels split. A survey network and a
crystal wireframe draw themselves; then a flash, and the crystal materialises with the real product frozen inside.
Each sport has its own matter and world:
- **Football (PERMAFROST):** an ice shard over a frozen pitch, in the snow.
- **Boxing (IMPACT):** cracked smoked glass in a concrete gym.
- **Swimming (ABYSS):** a living water orb over pool caustics.
- **Basketball (COURT):** a cut gem on hardwood.

**The HUD.** Monospace corner type, specimen callouts and live readouts.

**Interaction.**
- Drag the crystal to spin it, hold it to thaw the ice, click it to explore.
- Cuts between sports use a radial zoom blur with a chromatic split.
- Scrolling dollies the camera, and the hero melts into the page as liquid chrome.

**Palette.** "Glacier": frost white, steel and graphite with a single cobalt accent. No rainbow.

**Below the hero:**
- official brand logos
- light-up "Choose your arena" cards and tilt plates
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

## The hero stage

`src/components/hero/crystal/` contains:
- **`engine.ts`**: renderer, intro, cuts, input, HUD and an adaptive quality ladder.
- **`worlds.ts`**: per-sport crystal, material, ground, particles and readouts.
- **`textures.ts`**: every texture, procedural and drawn on canvases.
- **`CrystalHero.tsx`**: the React island.

three.js loads only on the client and only for the hero. Without WebGL 2 the hero falls back to a still frosted card.

For QA in development:
- Set `window.__crystalT = 1.3` in the console to freeze the opening.
- `node scripts/hero-frames.mjs --out=dir` renders frames of all four worlds.

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

- **Hero** (`src/components/hero/*`, `src/config/hero.ts`): WebGL crystal stage, HUD callouts, index nav with autoplay,
  swipe (direction-locked, vertical scroll stays native), arrows, keys, drag-to-spin, hold-to-thaw, click-to-explore.
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
- The category card photos are AI-generated stills supplied by the owner. The hero is real-time code (no video files).
- No payment provider is integrated; the checkout is clearly labelled as a demonstration.

Docs: `CLAUDE.md`, `DECISIONS.md`, `RESEARCH.md`, `SECURITY.md`, `ASSET_MANIFEST.md`, `VIDEO_PROMPTS.md`.
