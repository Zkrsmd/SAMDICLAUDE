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
- Hero = three.js "crystal" stage (`src/components/hero/crystal/*`): each sport's real product photo forms inside its own
  crystal, then it BREAKS with sport matter (owner-requested): football = frozen football popping along its 32 panels with
  grass + turf; boxing = glass slab with sweat, a few blood drops and hand-wrap ribbons; swimming = water orb into
  droplets; basketball = seamed amber glass ball with hardwood splinters + leather chips. Shards/droplets are flown in the
  vertex shader (`burst.ts`); sport debris is modelled in `debris.ts` and flown by the same shader (`flying()`).
  The stage is full screen (`100lvh`, type kept inside `100svh`). Scrolling never blurs the stage: from 36% of the hero's
  scroll the page's white POURS down over the world (the melt, in the post shader: drips, chrome lip, a bead of the
  sport's accent) and stops two-thirds down, so the world's floor leaves as a band between white and chrome drips.
  `LiquidSeam.tsx` repeats the chrome as pouring seams between homepage sections (CSS scroll timeline, no JS).
  At 32% of the hero's scroll the product is handed to the page
  (`HomeHero.tsx`, `setDrop`/`productRect`) and falls, as its real photo, onto the white page above the brands. The
  product page does the same on phones (viewer → purchase tray). The backdrop is the sport's film, full screen behind
  the crystal (graded cool in `FILM_FS`, push-in punched by the break; the painted sets in `textures.ts` remain only as the
  fallback without a film). The break throws out a crew of three more real products per sport (`heroCrew`), placed by
  visible width; swimming's products float on a 3D ocean (`ocean.ts`, the same swell on CPU and GPU) that ripples
  when the orb bursts. Controls on the stage: thin arrows on the screen edges and the statement itself as the link — no button.
  Survey network, HUD callouts and one post pass (zoom blur, shockwave, light sharpen, grain).
  The only 3D is glass + environment — products stay real photos. three is code-split (client only) with a still fallback
  without WebGL 2. `window.__crystalT` freezes the opening in dev; `scripts/hero-frames.mjs` renders frames.
  Slides, arena-card product picks (`arenaPicks`) and category photos: `src/config/hero.ts`.
- Homepage order: hero (frosted sport bubbles) → brands → category bubbles (`CategoryBubbles.tsx`, every subcategory) →
  best sellers (2 rows) → new in (3 rows, newest per sport) → everything else (`ProductStream`, 20 at a time + Show more).
  Product cards keep brand, name, price and the quick-add `+` INSIDE the card (`ProductCard.tsx`, `QuickAdd.tsx`).
- Product page: pinned viewer (desktop) / scroll drop into the buy box (phones) → "Complete the look" (3) → more from
  the same category. Hero films: `public/video` (Pexels License, cut by `scripts/edit-films.mjs`, credits beside them).
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
