---
name: ecommerce-quality-and-security
description: Use for catalogue data, cart/checkout, API routes, filters/search, security headers, accessibility and tests.
---

# E-commerce quality & security

## Data
- Products live in `src/data/products/*`, validated by `CatalogSchema` at load. Mark `verified: true` only with a source note.
- Components receive data from server code (`src/lib/catalog.ts`, `server-only`); never hardcode product facts in UI.

## Commerce rules
- Client stores ids/variants/qty only. Prices only from `POST /api/cart/quote` (Zod, whitelist, rate limit, origin check).
- Checkout stays a labelled demonstration until a real provider is integrated server-side. Never collect card data.
- No fake stock levels, delivery promises or order confirmations.

## Security
- Validate all URL/search/body input with Zod; no `dangerouslySetInnerHTML`; no open redirects; `rel="noopener noreferrer"`.
- Keep CSP in `next.config.ts` updated; no remote scripts or hotlinked assets; secrets only in env (never committed).

## Done means
`npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:e2e` pass; dialogs trap focus and close on Escape;
every journey works with keyboard, with reduced motion and with WebGL disabled.
