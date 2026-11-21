import 'server-only';
import { z } from 'zod';
import { usdToDzd } from '@/lib/format';
import { CreatedProductSchema, DeliverySchema, EMPTY_OVERRIDES, OrderPatchSchema, OverridesSchema, ProductInputSchema, type Overrides } from '@/lib/validation/admin';
import { getDb, randomToken } from './db';

/**
 * The admin's changes over the catalogue (edits, new products, deletions, stock, delivery prices,
 * sample-order patches), kept in the database (D1). Every write changes a version marker, so a
 * page view costs one tiny read to know whether the copy in memory is still current; the full
 * set is only read again after a change.
 *
 * Entry points (pages, routes, actions) call `loadStore()` before using the catalogue; the
 * catalogue then reads the copy in memory synchronously. Before the first load the store is the
 * plain catalogue, where every product is "Coming soon" — nothing can be sold by accident.
 */

export class ReadOnlyStoreError extends Error {
  constructor() {
    super('The store database is not available right now. Try again in a moment.');
  }
}
/** Kept for the callers that show a read-only notice: the database is always writable. */
export const storeWritable = () => true;

/** Files exported before the store switched to dinars hold US cents: convert their prices once. */
export function toDinars(o: Overrides): Overrides {
  if (o.currency === 'DZD') return o;
  const conv = <T extends { price: number; compareAt: number | null; cost: number | null }>(p: T): T => {
    const price = usdToDzd(p.price);
    const compareAt = p.compareAt === null ? null : usdToDzd(p.compareAt);
    return { ...p, price, compareAt: compareAt !== null && compareAt > price ? compareAt : null, cost: p.cost ? usdToDzd(p.cost) : p.cost };
  };
  return {
    ...o,
    currency: 'DZD',
    products: Object.fromEntries(Object.entries(o.products).map(([k, v]) => [k, conv(v)])),
    created: o.created.map(conv),
  };
}

interface Cached {
  version: string;
  data: Overrides;
  media: Map<string, number>;
}
let cache: Cached | null = null;

const MetaDeleted = z.array(z.string());
const MetaOrders = z.record(z.string(), OrderPatchSchema);

async function readAll(db: D1Database, version: string): Promise<Cached> {
  const [products, meta, media] = await db.batch([
    db.prepare('SELECT slug, kind, pos, data FROM store_products ORDER BY pos, slug'),
    db.prepare("SELECT key, value FROM store_meta WHERE key <> 'version'"),
    db.prepare('SELECT key, v FROM media'),
  ]);
  const data: Overrides = structuredClone(EMPTY_OVERRIDES);
  for (const r of (products!.results ?? []) as { slug: string; kind: string; data: string }[]) {
    try {
      const raw = JSON.parse(r.data);
      const parsed = r.kind === 'edit' ? ProductInputSchema.safeParse(raw) : CreatedProductSchema.safeParse(raw);
      if (!parsed.success) throw new Error('invalid');
      if (r.kind === 'edit') data.products[r.slug] = parsed.data as z.infer<typeof ProductInputSchema>;
      else data.created.push(parsed.data as z.infer<typeof CreatedProductSchema>);
    } catch {
      console.error(`[store] unreadable product row ${r.slug}`);
    }
  }
  for (const r of (meta!.results ?? []) as { key: string; value: string }[]) {
    try {
      const v = JSON.parse(r.value);
      if (r.key === 'deleted') data.deleted = MetaDeleted.parse(v);
      else if (r.key === 'orders') data.orders = MetaOrders.parse(v);
      else if (r.key === 'delivery' && v) data.delivery = DeliverySchema.parse(v);
      else if (r.key === 'updatedAt') data.updatedAt = typeof v === 'string' ? v : null;
    } catch {
      console.error(`[store] unreadable setting ${r.key}`);
    }
  }
  const m = new Map<string, number>();
  for (const r of (media!.results ?? []) as { key: string; v: number }[]) m.set(r.key, r.v);
  return { version, data, media: m };
}

/** Bring the in-memory copy up to date (one small read when nothing changed). */
export async function loadStore(): Promise<Overrides> {
  let db: D1Database;
  try {
    db = await getDb();
  } catch (e) {
    // no database (static snapshot build): the plain catalogue, everything "Coming soon"
    if (!cache) console.warn('[store] no database:', (e as Error).message);
    return readOverrides();
  }
  const row = await db.prepare("SELECT value FROM store_meta WHERE key = 'version'").first<{ value: string }>();
  const version = row?.value ?? 'none';
  if (!cache || cache.version !== version) cache = await readAll(db, version);
  return cache.data;
}

/** The copy loaded by the last `loadStore()` (the plain catalogue before the first load). */
export function readOverrides(): Overrides {
  return cache?.data ?? EMPTY_OVERRIDES;
}

/** Product photos uploaded in the admin: key ("<slug>-<1|2>") → version. */
export const uploadedMedia = () => cache?.media ?? new Map<string, number>();

const json = (v: unknown) => JSON.stringify(v);

/**
 * Apply a change and save it. Optimistic: the write only lands if nobody else saved in between
 * (the version marker is checked in the same transaction); otherwise it re-reads and tries again.
 */
export async function updateOverrides(change: (draft: Overrides) => void): Promise<Overrides> {
  const db = await getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    cache = null; // always start from the database
    const before = await loadStore();
    const oldVersion = cache ? (cache as Cached).version : 'none';
    const draft: Overrides = structuredClone(before);
    change(draft);
    draft.updatedAt = new Date().toISOString();
    const next = OverridesSchema.parse(draft);
    const newVersion = randomToken(12);
    const guard = "(SELECT value FROM store_meta WHERE key = 'version') = ?";
    const stmts: D1PreparedStatement[] = [db.prepare("UPDATE store_meta SET value = ? WHERE key = 'version' AND value = ?").bind(newVersion, oldVersion)];
    // products: write the changed ones, drop the removed ones
    for (const [slug, input] of Object.entries(next.products))
      if (json(before.products[slug]) !== json(input))
        stmts.push(
          db
            .prepare(`INSERT INTO store_products (slug, kind, pos, data) SELECT ?, 'edit', 0, ? WHERE ${guard} ON CONFLICT(slug) DO UPDATE SET kind = 'edit', data = excluded.data`)
            .bind(slug, json(input), newVersion),
        );
    for (const slug of Object.keys(before.products))
      if (!next.products[slug]) stmts.push(db.prepare(`DELETE FROM store_products WHERE slug = ? AND kind = 'edit' AND ${guard}`).bind(slug, newVersion));
    const oldCreated = new Map(before.created.map((c, i) => [c.slug, { c, i }]));
    next.created.forEach((c, i) => {
      const old = oldCreated.get(c.slug);
      if (!old || old.i !== i || json(old.c) !== json(c))
        stmts.push(
          db
            .prepare(`INSERT INTO store_products (slug, kind, pos, data) SELECT ?, 'created', ?, ? WHERE ${guard} ON CONFLICT(slug) DO UPDATE SET kind = 'created', pos = excluded.pos, data = excluded.data`)
            .bind(c.slug, i, json(c), newVersion),
        );
    });
    const keep = new Set(next.created.map((c) => c.slug));
    for (const c of before.created) if (!keep.has(c.slug)) stmts.push(db.prepare(`DELETE FROM store_products WHERE slug = ? AND kind = 'created' AND ${guard}`).bind(c.slug, newVersion));
    // settings
    const meta: [string, unknown][] = [
      ['deleted', next.deleted],
      ['orders', next.orders],
      ['delivery', next.delivery ?? null],
      ['updatedAt', next.updatedAt],
    ];
    const old: Record<string, unknown> = { deleted: before.deleted, orders: before.orders, delivery: before.delivery ?? null, updatedAt: before.updatedAt };
    for (const [key, value] of meta)
      if (json(old[key]) !== json(value))
        stmts.push(db.prepare(`INSERT INTO store_meta (key, value) SELECT ?, ? WHERE ${guard} ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, json(value), newVersion));
    const results = await db.batch(stmts);
    if ((results[0]!.meta.changes ?? 0) === 1) {
      cache = null;
      return loadStore();
    }
    // someone else saved first: try again on their version
  }
  throw new Error('The store is busy. Try again.');
}

/** Replace the whole store (settings → import / reset). */
export function replaceOverrides(next: Overrides) {
  return updateOverrides((d) => {
    d.products = next.products;
    d.created = next.created;
    d.deleted = next.deleted;
    d.orders = next.orders;
    d.delivery = next.delivery;
  });
}

/** Mark the store as changed (after a photo upload) so every server instance picks it up. */
export async function bumpStoreVersion() {
  const db = await getDb();
  await db.prepare("UPDATE store_meta SET value = ? WHERE key = 'version'").bind(randomToken(12)).run();
  cache = null;
}
