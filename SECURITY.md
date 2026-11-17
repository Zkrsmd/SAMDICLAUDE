# Security

## Decisions
- **Server-side pricing.** The cart stores only product id, colour, size and quantity. Totals come from
  `POST /api/cart/quote`, which validates input with Zod, whitelists ids/variants against the catalogue,
  ignores any client-sent price, limits quantity (1–20) and line count (≤50), rejects bodies >16 KB,
  rejects cross-origin `Origin` headers, and is rate-limited (120 req/min per client).
- **Untrusted URL input.** Listing filters/sort/search (`?brand=&color=&size=&min=&max=&sort=&q=`) are parsed with
  `ListingParamsSchema` (allow-listed characters, length and range limits).
- **No dynamic HTML.** No `dangerouslySetInnerHTML`. External links use `rel="noopener noreferrer"`. No redirects
  built from user input.
- **Errors.** `app/error.tsx` never renders error messages or stacks; the API returns generic messages.
- **Demo checkout.** No payment form, no card data, no order creation, no fake confirmation.

## HTTP headers (`next.config.ts`)
`Content-Security-Policy` (default-src 'self'; frame-ancestors 'none'; object-src 'none'; worker-src 'self' blob:),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (camera, microphone, geolocation, payment, usb disabled), `Cross-Origin-Opener-Policy: same-origin`,
`Strict-Transport-Security` (production only).

**Known trade-off:** `script-src` includes `'unsafe-inline'` so pages can stay statically generated (Next.js injects
inline bootstrap scripts). Upgrade path: nonce-based CSP via `proxy.ts` (Next 16) — pages then render dynamically.

## Secrets & dependencies
- `.env*` is git-ignored; `.env.example` holds placeholders only. Secrets must stay server-side.
- All dependencies are pinned to exact versions; `package-lock.json` is committed. TypeScript 5.9 and ESLint 9
  are deliberately held back for tooling compatibility (see `DECISIONS.md`).
- No remote scripts or hotlinked assets; all assets are local or generated.

## Known limitations (prototype)
- Rate limiting is in-memory per instance (not shared across servers).
- Cart, wishlist and recently-viewed data live in `localStorage` on the device.
- No authentication, accounts, CSRF tokens or order storage exist yet (no state-changing endpoints beyond the read-only quote).
- No remote images or video: product photos, brand logos and campaign media are downloaded once at build time into `public/` and served from `'self'` (CSP `img-src`/`media-src`). The download helpers (`scripts/build-catalog.mjs`, `scripts/cutout-rembg.py`) are local tools, never run in the app.

## Before production
Integrate a certified payment provider server-side (hosted fields / checkout), add a shared rate limiter
(e.g. Redis at the edge), move to nonce-based CSP, add authentication and CSRF protection for any account or
order endpoints, server-side order validation with idempotency keys, monitoring and dependency auditing in CI.
