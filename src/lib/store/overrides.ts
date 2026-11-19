import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import bundled from '@/data/store/overrides.json';
import { EMPTY_OVERRIDES, OverridesSchema, type Overrides } from '@/lib/validation/admin';

/**
 * The admin's store file: every change made in /admin (edits, new products, deletions, order
 * status). It lives in the project (src/data/store/overrides.json), so changes made locally go
 * live when the project is committed and deployed. The storefront reads it fresh on every render.
 *
 * Hosted deployments (Vercel) have a read-only file system: there the admin can look but not save.
 */

const FILE = path.join(process.cwd(), 'src', 'data', 'store', 'overrides.json');

export class ReadOnlyStoreError extends Error {
  constructor() {
    super('This deployment is read-only. Run the admin from the project (npm run dev / npm start) to save changes.');
  }
}

export const storeWritable = () => !process.env.VERCEL;

const parsedBundled: Overrides = (() => {
  const r = OverridesSchema.safeParse(bundled);
  return r.success ? r.data : EMPTY_OVERRIDES;
})();

let cache: { mtime: number; size: number; data: Overrides } | null = null;

/** Current store data. Returns the same object until the file changes (callers memoise on identity). */
export function readOverrides(): Overrides {
  try {
    const st = fs.statSync(FILE);
    if (cache && cache.mtime === st.mtimeMs && cache.size === st.size) return cache.data;
    const parsed = OverridesSchema.safeParse(JSON.parse(fs.readFileSync(FILE, 'utf8')));
    // a hand-edited file that no longer validates must not take the store down: keep the last good copy
    const data = parsed.success ? parsed.data : (cache?.data ?? parsedBundled);
    if (!parsed.success) console.error('[store] overrides.json is invalid, using the last good copy');
    cache = { mtime: st.mtimeMs, size: st.size, data };
    return data;
  } catch {
    return cache?.data ?? parsedBundled;
  }
}

// one write at a time (read → change → write must not interleave between two saves)
let queue: Promise<unknown> = Promise.resolve();

export function updateOverrides(change: (draft: Overrides) => void): Promise<Overrides> {
  const run = queue.then(() => {
    if (!storeWritable()) throw new ReadOnlyStoreError();
    const draft: Overrides = structuredClone(readOverrides());
    change(draft);
    draft.updatedAt = new Date().toISOString();
    const next = OverridesSchema.parse(draft);
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, FILE);
    cache = null;
    return readOverrides();
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Replace the whole store (settings → import / reset). */
export function replaceOverrides(next: Overrides) {
  return updateOverrides((d) => {
    d.products = next.products;
    d.created = next.created;
    d.deleted = next.deleted;
    d.orders = next.orders;
  });
}
