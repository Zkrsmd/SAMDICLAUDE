-- SMADI store database (Cloudflare D1). Apply with: npx wrangler d1 migrations apply smadi [--local|--remote]

-- the admin's changes over the catalogue: edits to catalogue products and products added in the admin
CREATE TABLE store_products (
  slug TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('edit', 'created')),
  pos INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
);

-- small store-wide values: version (changes on every write), deleted products, delivery prices, sample-order patches
CREATE TABLE store_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO store_meta (key, value) VALUES ('version', 'init');

-- cash-on-delivery orders. `data` holds the whole order (customer, lines, totals, history);
-- `receipt` is the SHA-256 of the customer's private receipt link token (the token itself is never stored);
-- `client` is a salted hash of the buyer's connection, used only to limit fake orders.
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  receipt TEXT NOT NULL UNIQUE,
  client TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX orders_by_client ON orders (client, created_at);

-- product photos uploaded in the admin (WebP, converted in the browser before upload)
CREATE TABLE media (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  bytes BLOB NOT NULL,
  v INTEGER NOT NULL
);

-- fixed-window counters for sign-in attempts and orders (keys are hashes, never raw addresses)
CREATE TABLE rate (
  key TEXT PRIMARY KEY,
  start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
