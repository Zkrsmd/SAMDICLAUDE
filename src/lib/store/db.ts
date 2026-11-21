import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * The store's database: Cloudflare D1 (binding `DB`, schema in migrations/). In production it is
 * the hosted database; under `npm run dev` / `npm run preview` it is a local SQLite copy in
 * .wrangler/state (create it with `npm run db:local`).
 */
export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as Partial<CloudflareEnv>).DB;
  if (!db) throw new Error('The database binding (DB) is missing — see wrangler.jsonc');
  return db;
}

/** SHA-256 → hex (Web Crypto: works in Workers and Node). */
export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** An unguessable token (256 bits by default, URL-safe). */
export function randomToken(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
