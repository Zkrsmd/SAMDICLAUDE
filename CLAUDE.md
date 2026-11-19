# CLAUDE.md — project guide

## Purpose
Premium, mobile-first sports e-commerce prototype for **SMADI** (hand mark logo) that feels like an award-site
campaign and a real store at once. Real product photos (background removed) and real media only — **no 3D models**
(the owner rejected the procedural/"comic" look).

## Non-negotiable visual rules
- Palette "glacier": frost `#F3F4F6`, white, mist/stone `#E8EBEF`, steel `#8E99A8`, ink `#0F1216` (text), ONE accent
  cobalt `#2B59FF`. **No rainbow/holographic colours** (owner rejected them). The hero is a cool, atmospheric grey world
  (igloo.inc-inspired); the rest of the site is frost-white. Never a dark/neon site.
- Effects language (class names kept from the old holo era, now chrome): `.holo-border`/`.holo-ring` = travelling
  chrome edge with a cobalt glint, `.btn-holo` white pill, `.holo-text` dark steel text with a cobalt glint, `.glass`,
  film grain, `[data-reveal]`. Liquid elements are chrome (mercury). Use these, don't invent new gradients.
- Type: Archivo 900 condensed italic (display — the owner's "action font", `.display`), Sora (body), Geist Mono
  (labels). No Inter/Arial. Keep headings modest (sections ≈ `clamp(30px,6.2vw,78px)`), the owner finds big type too loud.
- The sport word is composition (behind objects, on walls, on pool floors), not a caption.

## Architecture
- `src/app` routes (Server Components by default). Client islands only for canvases, gestures, stores.
- `src/data` catalogue → validated by Zod in `src/lib/catalog.ts` (`server-only`). Never hardcode product facts in components.
- Product images: `/products/<slug>-1.webp` (hero) and `-2.webp` (second view) via `renderUrl()` in `src/lib/format.ts`.
- Hero = full-screen sport FILMS (owner-requested; no 3D, no explosion, no product): `src/components/hero/Hero.tsx`.
  One short, hard-cut film per sport (speed ramps, push-in, a punch on each cut) made by `scripts/edit-films.mjs` from the
  owner's clips in `tiktok/` (gitignored) and Pexels dunks, in two shapes: `public/video/<sport>.mp4` (landscape) and
  `<sport>-p.mp4` (portrait, picked by `<source media>` = `HERO_TALL_QUERY`), each with a `.webp` still. Over the film, the
  sport's name in big see-through white (`.hero-word`, letters rise in), which is the link to the sport — no button.
  Films change when they end (held on hover / off screen / the Pause control / reduced motion), or by the edge arrows,
  the index, a swipe or the arrow keys: the new film wipes in from its side (`hero-wipe-in`, `--d`). The hero is sticky;
  the store after it is one `.home-sheet` that slides up over it while `--p` pushes the film in and darkens it.
  Smooth wheel scrolling site-wide is Lenis (`SmoothScroll.tsx`, `src/lib/smooth-scroll.ts`; dialogs hold it via `useDialog`).
  Slides, arena-card product picks (`arenaPicks`) and category photos: `src/config/hero.ts`.
- Homepage order: hero (sport films) → brands → category bubbles (`CategoryBubbles.tsx`, every subcategory) →
  best sellers (2 rows) → new in (3 rows, newest per sport) → everything else (`ProductStream`, 20 at a time + Show more).
  Product cards keep brand, name, price and the quick-add `+` INSIDE the card (`ProductCard.tsx`, `QuickAdd.tsx`).
- Product page: pinned viewer (desktop) / scroll drop into the buy box (phones) → "Complete the look" (3) → more from
  the same category. Hero films: `public/video` (cut by `scripts/edit-films.mjs`, sources and rights in `CREDITS.md`).
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
