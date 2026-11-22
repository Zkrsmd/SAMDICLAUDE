import 'server-only';
import { getDb } from './db';

/**
 * What customers buy together (D1 `copurchase`): every order adds 1 to each pair of products in it
 * (both directions) and 1 to each product's own count. "Complete the look" blends these counts
 * with the shop's own picks — see `boughtWith()` in src/lib/catalog.ts. Counts only, no customer data.
 */

/** Count one order's products (called after an order is saved; never blocks or fails the order). */
export async function recordOrder(slugs: string[]) {
  const list = [...new Set(slugs)].slice(0, 30);
  if (!list.length) return;
  try {
    const db = await getDb();
    const up = db.prepare('INSERT INTO copurchase (a, b, n) VALUES (?, ?, 1) ON CONFLICT(a, b) DO UPDATE SET n = n + 1');
    const stmts: D1PreparedStatement[] = [];
    for (const a of list) for (const b of list) stmts.push(up.bind(a, b));
    await db.batch(stmts);
    cache.clear();
  } catch (e) {
    console.error('[copurchase] not counted', (e as Error).message);
  }
}

export interface Together {
  /** orders that contained this product */
  orders: number;
  /** other product → orders that contained both */
  with: Map<string, number>;
}

const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; v: Together }>();

/** What was bought with this product (cached a few minutes per server instance). */
export async function boughtTogether(slug: string): Promise<Together> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const v: Together = { orders: 0, with: new Map() };
  try {
    const db = await getDb();
    const { results } = await db.prepare('SELECT b, n FROM copurchase WHERE a = ? ORDER BY n DESC LIMIT 60').bind(slug).all<{ b: string; n: number }>();
    for (const r of results ?? []) {
      if (r.b === slug) v.orders = r.n;
      else v.with.set(r.b, r.n);
    }
  } catch {
    /* no table yet, or no database: the shop's picks alone */
  }
  if (cache.size > 2000) cache.clear();
  cache.set(slug, { at: Date.now(), v });
  return v;
}
