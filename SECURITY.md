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
- **Checkout (cash on delivery).** No payment form and no card data: customers pay the courier in cash. `POST
  /api/orders` is same-origin only, size-limited, validated with Zod (Algerian mobile, wilaya 1–58, lengths), prices
  every line and the delivery fee on the server (client prices are never read), checks stock, and is rate limited
  (6 valid orders / 10 min per address, shared across servers in D1) with a honeypot field for bots. Orders hold
  personal data (name, phone, address) and live only in the Cloudflare D1 database (`orders` table), reachable by
  the admin session. Coming-soon and out-of-stock products are refused by the quote and order APIs.
- **Receipts ("each customer sees only their own").** Placing an order returns a private link `/order/<token>`: a
  256-bit random token; the database stores only its SHA-256, so even a copy of the table can't be turned into
  links. Order numbers alone open nothing. Receipt pages mask the phone, are `Cache-Control: private, no-store`,
  `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, and are rate limited.
- **Admin.** `/admin` is locked by `ADMIN_PASSWORD` (a Cloudflare secret in production, `.env.local`/`.dev.vars`
  locally; 8+ characters; unset = locked). Sign-in is rate limited in D1 (8 tries / 15 min per address and 60 / hour
  for the whole site) and compared in constant time; the session is an HMAC-signed, http-only,
  `SameSite=Strict`, `Secure` (production) cookie that lasts 12 hours, keyed from the password (or
  `ADMIN_SESSION_SECRET`), so changing the password signs everyone out. Every admin page, server action and admin API
  checks the session itself (not only a layout). All writes are validated with Zod and saved to D1 in one
  transaction guarded by a version token (no lost updates). Photo uploads are converted to WebP in the browser; the
  server accepts only same-origin, signed-in uploads of ≤ 1.8 MB whose bytes are a real WebP, stored in D1 `media`.
  Admin pages are `noindex`. Website orders (customer name, phone, address) are visible only behind the admin session.

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

## Hosting (Cloudflare)
- Next.js runs on Cloudflare Workers (OpenNext); data in D1 (`migrations/`). Raw IPs are never stored: rate-limit
  keys and the order `client` column are salted SHA-256 hashes (salt = `ADMIN_SESSION_SECRET`).
- Secrets: `wrangler secret put ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET`; locally `.dev.vars` (git-ignored).
- Every SQL statement is parameterised (`prepare().bind()`).

## Known limitations
- The quote endpoint's limiter is in-memory per server (cheap, read-only endpoint); the others use D1.
- Cart, wishlist and recently-viewed data live in `localStorage` on the device.
- The admin has one shared password, no per-user accounts or audit log. Optional extra layer: Cloudflare Access
  (Zero Trust, free for small teams) in front of `/admin*` with email one-time codes.
- No remote images or video: product photos, brand logos and campaign media are downloaded once at build time into `public/` and served from `'self'` (CSP `img-src`/`media-src`). The download helpers (`scripts/build-catalog.mjs`, `scripts/cutout-rembg.py`) are local tools, never run in the app.

## Next steps
Nonce-based CSP, Cloudflare Access on the admin, idempotency keys on orders, regular D1 backups
(`wrangler d1 export smadi --remote`), dependency auditing in CI.
