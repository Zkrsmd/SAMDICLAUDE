# CLAUDE.md — project guide

## Purpose
Premium, mobile-first sports e-commerce store **STRYKE** (formerly REVO; social handles "Stryke Algeria") (the name is the logo — `Wordmark.tsx`; the favicon `app/icon.svg` is the S) that feels like an award-site
campaign and a real store at once. Real product photos (background removed) and real media only — **no 3D models**
(the owner rejected the procedural/"comic" look).

## Non-negotiable visual rules
- Palette "glacier": frost `#F3F4F6`, white, mist/stone `#E8EBEF`, steel `#8E99A8`, ink `#0F1216` (text), ONE accent
  cobalt `#2B59FF` — plus one signal red (`.btn-order`) reserved for the order buttons (owner-requested). **No rainbow/holographic colours** (owner rejected them). The hero is a cool, atmospheric grey world
  (igloo.inc-inspired); the rest of the site is frost-white. Never a dark/neon site.
- Effects language (class names kept from the old holo era, now chrome): the header bar is midnight cobalt (`.hdr`: night-blue, drifting cobalt lights, a glint
  travelling round the rim — all transforms; the owner chose one dark blue for it);
  `.holo-border`/`.holo-ring` = travelling
  chrome edge with a cobalt glint, `.btn-holo` white pill, `.holo-text` dark steel text with a cobalt glint, `.glass`,
  film grain, `[data-reveal]`. Liquid elements are chrome (mercury). Use these, don't invent new gradients.
- Type: Archivo 900 condensed italic (display — the owner's "action font", `.display`), Sora (body), Geist Mono
  (labels). No Inter/Arial. Keep headings modest (sections ≈ `clamp(30px,6.2vw,78px)`), the owner finds big type too loud.
- The sport word is composition (behind objects, on walls, on pool floors), not a caption.

## Architecture
- `src/app` routes (Server Components by default). Client islands only for canvases, gestures, stores.
  Storefront pages live in the `(store)` route group (its layout = `StoreChrome`: header, footer, bag, search, effects);
  the admin lives in `src/app/admin` with its own frame. The root layout is only the document shell.
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
  Slides, the sport-circle cut-outs (`sportIcons`) and category photos: `src/config/hero.ts`.
- Homepage order: hero (sport films) → brands → shop by sport (`SportShop.tsx`: a small circle per sport with one cut-out that opens that
  sport IN PLACE — its best sellers, new releases, all its products with category chips and "See all"; `?sport=` keeps it) →
  best sellers (2 rows) → new in (3 rows, newest per sport) → everything else (`ProductStream`, 20 at a time + Show more).
  Product cards keep a short name, the price (was-price when on sale) and the quick-add `+` INSIDE the card, no brand
  (`ProductCard.tsx`, `QuickAdd.tsx`; sold-out sizes can't be picked). Availability (`availability()` in `catalog.ts`):
  "Coming soon" (admin switch `comingSoon`, with or without stock: shown, not sold) wins over "Out of stock" (every size
  at 0); both badge the card, disable the `+` and replace the buy box; the quote and order APIs refuse them.
- Product page: one still photo with a big word behind it (the admin's "Word behind the photo", else the brand; any
  length fits one line via `--n`) (pinned beside the details on desktop) — no scroll animation (owner: it felt like an
  ad) — then straight to the buy box: colour ONLY when the admin set colours (`colorChoice`), size, then quantity +
  "Add" filling one row, and the short cash-on-delivery order form itself (`QuickBuy.tsx`: the red "Order now" orders
  the whole bag plus the current pick, then empties the bag; quantities max 5). Anything missing (no size, a wrong
  field) scrolls back to it with the reason in red (`goToField()`, `src/lib/scroll-to.ts`); the red clears as soon as it's
  fixed → "Complete the look" (3: `boughtWith()` in `catalog.ts` = the shop's picks — the admin's, else one per paired
  category — blended with what customers buy together, D1 `copurchase`, weight orders/(orders+150), pairs need ≥3
  orders) → more from the same category. Hero films: `public/video` (cut by `scripts/edit-films.mjs`, sources and rights in `CREDITS.md`).
- `src/stores` Zustand (cart stores ids/variants/qty only; prices come from `POST /api/cart/quote`).
- Money is Algerian dinars, kept in centimes (DA × 100) like cents; `formatPrice` prints "12 500 DA".
- Catalogue = the shop's Odoo export + the jersey collection: `scripts/odoo-xlsx.py` (xlsx → JSON) →
  `scripts/import-odoo.mjs` (English names, sports/categories, sizes, skip list, jerseys, image queries) →
  `scripts/fetch-images.mjs` (photo per product, `media-src/odoo/images.json` keeps the picks; `<slug> <n|url>` re-picks)
  → `scripts/odoo-catalog.mjs` writes `src/data/products/generated.json`. Every product starts "Coming soon";
  stock starts from Odoo for one-size items, 0 for sized ones. Luxury-brand copies are never listed.
- Checkout = cash on delivery, Algeria only (`/checkout`, `CodCheckout.tsx`): first/last name, Algerian mobile, wilaya
  (58), commune, ZR Express home or stop desk, note — NO street address (owner: not needed in Algeria). One "full name" field (split into
  first/last by `splitName()`). We always confirm by a call (≈ within the hour); the SMS option was removed.
  `POST /api/orders` re-validates (`src/lib/validation/order.ts`), prices from the catalogue + `deliveryFee()`
  (`src/lib/delivery.ts`; starting prices in `src/data/delivery/wilayas.ts`, edited in Admin → Delivery), checks stock,
  and saves to the D1 `orders` table (`src/lib/store/orders.ts`), returning a private receipt link `/order/<token>`
  (only the token's hash is stored). Tracked stock goes down on order and back up on cancel/return. Fake-order guards: a
  honeypot field and 6 valid orders / 10 min per address. Nothing sends SMS: the admin calls or texts by hand.
- Admin (`/admin`, Shopify-style): home dashboard, orders, products (index + editor), collections, inventory, customers,
  analytics, settings. Sign-in: `ADMIN_PASSWORD` in `.env.local` (`src/lib/admin/auth.ts`, signed http-only cookie;
  every page and action calls the guard itself). Writes go through server actions (`src/app/admin/actions.ts`, Zod
  schemas in `src/lib/validation/admin.ts`) into the D1 database (`src/lib/store/overrides.ts`: `store_products`,
  `store_meta`; a version token makes a page view one tiny read), which `src/lib/catalog.ts` merges over the catalogue —
  so the store shows admin changes at once. EVERY page/route/action calls `ensureStore()` (admin: `loadAdminData()`)
  before using the catalogue. Photo uploads: browser → WebP → `/api/admin/media` → D1 `media`, served at `/media/…`.
  Orders: real website orders with statuses (`src/lib/order-status.ts`) new (to confirm) → [no answer] → confirmed →
  preparing → shipped → delivered, or cancelled / returned (`setOrderStatus`; any status can be picked from a list). The
  admin can correct an order's customer details (delivery price follows), edit a customer (name/phone on all their
  orders, private note, tags; `/admin/customers/[tel:…]`), print a receipt (`/admin/print/[id]`, A4 or 80 mm ticket, in
  French), and hear a "ka-ching" for new orders while the admin is open (`OrderAlerts.tsx`: polls
  `/api/admin/orders/latest` every 15 s, Web-Audio sound, system notification; the bell turns it on). Footer social
  links + e-mail are edited in Settings (`siteLinks()`); there is no phone number on the site. Product editor: colours
  list (empty = none shown), word behind the photo, "Complete the look" picks. Until the first real order exists the admin shows SAMPLE orders instead
  (`src/lib/admin/orders.ts`, seeded per day, labelled), so fake sales never mix with real ones.
- `scripts/build-catalog.mjs` builds the catalogue + cut-outs from `media-src/raw/*.json`; `scripts/cutout-rembg.py` re-cuts hard backgrounds.

## Languages
English, French, Arabic (right to left). Write text in English in the code as `t('…')` (`useT()` in client components,
`await getT()` in server ones, `src/i18n/`); add its French and Arabic to `src/i18n/fr.ts` / `ar.ts` and check with
`node scripts/i18n-keys.mjs` (must say 100% for both). The `lang` cookie holds the choice; without it a picker opens
first (`LanguageGate`, the hero waits). Without a cookie (and for search engines) pages render in French (`DEFAULT_LOCALE`). Use logical classes (`ms-/me-/ps-/start-/end-/text-end`), not left/right.
Product names stay as written; the admin stays English.

## Product search
`src/lib/search.ts` (shared by the search page and the instant overlay): accents/Arabic letter forms normalised,
plurals folded, an EN/FR/AR/Darija synonym table ("gants" = "gloves" = "قفازات"), prefix-while-typing, typo tolerance
(swapped letters count once), ranked by name > category > brand > sport; on-sale first; if nothing matches every word,
the closest products. Category and sport names are indexed in all three languages.

## Search (SEO, Algerian market)
`src/lib/seo.ts` + `src/config/site.ts` (`SITE_URL`, server env `SITE_URL`, defaults to the live address): localized titles
and descriptions with local terms ("prix en Algérie", "58 wilayas"), a canonical per page (filters never canonical),
`robots.ts` (admin/api/cart/checkout/order/wishlist/search blocked), `sitemap.ts` (every sport, category, product, from the
live catalogue), schema.org JSON-LD via `components/seo/JsonLd.tsx` (OnlineStore + WebSite search on the home page; Product
+ Offer in DZD + BreadcrumbList on product pages). JsonLd renders a <script> text child — never dangerouslySetInnerHTML.

## Hosting
Cloudflare Workers via OpenNext (`wrangler.jsonc`, `open-next.config.ts`), D1 database `smadi` (schema in
`migrations/`), live at https://smadi.zkrsmdndr.workers.dev. Secrets: `wrangler secret put ADMIN_PASSWORD` /
`ADMIN_SESSION_SECRET`. The free plan's 10 ms CPU limit is too low for page renders (40–70 ms): Workers Paid needed.

## Commands
`npm run dev` · `npm run preview` (Workers runtime + local D1, port 8787; tests run against it) · `npm run deploy` ·
`npm run db:local` / `db:remote` (migrations) · `npm run typecheck` · `npm run lint` · `npm run test:e2e` ·
`npm run catalog` · `npm run photos`

## Quality standards
- Typecheck, lint and Playwright must pass before committing.
- Inspect real output (screenshots via `scripts/qa-shots.mjs` or the browser pane) — compiling is not enough.
- Respect `prefers-reduced-motion`; swipe is never the only control; videos always have a still poster.
- Nothing may make a page wider than the phone (a wider page opens zoomed out): flex/grid children that hold long text
  get `min-w-0` / `minmax(0,1fr)`, and nothing is parked far off to one side (in Arabic that widens the page) — the
  smoke test checks every key page in French and Arabic. Form fields are ≥ 16px on touch screens (no iPhone zoom on tap).
- Animation state lives in refs/CSS variables, never React state per frame.

## Security restrictions
- No secrets in the repo; `.env.example` only. Never trust client prices/quantities; validate with Zod.
- No `dangerouslySetInnerHTML`, no remote scripts/hotlinked assets, no payment handling, no permission bypasses.
- Keep CSP/headers in `next.config.ts` in sync with any new asset origins (see `SECURITY.md`).
