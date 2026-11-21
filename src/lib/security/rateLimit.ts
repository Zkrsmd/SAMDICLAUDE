import 'server-only';
import { getDb, sha256 } from '@/lib/store/db';

/**
 * Fixed-window rate limits shared by every server (D1 `rate` table), for the things worth
 * protecting: admin sign-in, orders, uploads. Keys are salted hashes — raw addresses are never stored.
 * The quote endpoint (cheap, read-only) uses the in-memory limiter below instead of the database.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean }> {
  try {
    const db = await getDb();
    const now = Date.now();
    const k = await sha256(`smadi-rate|${process.env.ADMIN_SESSION_SECRET ?? ''}|${key}`);
    const row = await db
      .prepare(
        `INSERT INTO rate (key, start, count) VALUES (?1, ?2, 1)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN ?2 - start > ?3 THEN 1 ELSE count + 1 END,
           start = CASE WHEN ?2 - start > ?3 THEN ?2 ELSE start END
         RETURNING count`,
      )
      .bind(k, now, windowMs)
      .first<{ count: number }>();
    // now and then, forget windows older than a day
    if (Math.random() < 0.02) await db.prepare('DELETE FROM rate WHERE start < ?').bind(now - 86_400_000).run();
    return { ok: (row?.count ?? 1) <= limit };
  } catch (e) {
    console.error('[rate] limiter unavailable', e);
    return { ok: true };
  }
}

const windows = new Map<string, { start: number; count: number }>();
/** Per-server, in-memory limiter for cheap endpoints. */
export function softRateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > windowMs) {
    if (windows.size > 5000) windows.clear();
    windows.set(key, { start: now, count: 1 });
    return { ok: true };
  }
  w.count += 1;
  return { ok: w.count <= limit };
}

/**
 * The visitor's address: on Cloudflare, `cf-connecting-ip` (set by Cloudflare, can't be forged by
 * the client). Elsewhere the platform's x-real-ip, or the right-most X-Forwarded-For hop.
 */
export function clientKey(headers: Headers) {
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const hops = headers.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  return hops[hops.length - 1] ?? 'local';
}
