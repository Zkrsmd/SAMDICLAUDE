import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, verifyToken } from '@/lib/admin/auth';
import { ensureStore, getAdminProduct } from '@/lib/catalog';
import { getDb } from '@/lib/store/db';
import { bumpStoreVersion } from '@/lib/store/overrides';
import { clientKey, rateLimit } from '@/lib/security/rateLimit';

const MAX_BYTES = 1_800_000;

/** RIFF....WEBP — the browser converts every upload to WebP before sending it. */
const isWebp = (b: Uint8Array) =>
  b.length > 16 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;

/**
 * Product photo upload (admin only). The editor turns the chosen picture into a WebP (at most
 * 1600px) in the browser; here we check the session, the product, the size and that the bytes
 * really are a WebP, then keep it in the database. The store serves it from /media/<slug>-<slot>.webp.
 */
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && !!host && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  if (!verifyToken((await cookies()).get(ADMIN_COOKIE)?.value)) return NextResponse.json({ error: 'Sign in again' }, { status: 401 });
  if (!(await rateLimit(`admin-media:${clientKey(req.headers)}`, 60, 10 * 60_000)).ok) return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });
  if (Number(req.headers.get('content-length') ?? '0') > MAX_BYTES + 64 * 1024) return NextResponse.json({ error: 'That photo is too large' }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a file upload' }, { status: 400 });
  }
  await ensureStore();
  const slug = form.get('slug');
  const slot = form.get('slot');
  const file = form.get('file');
  if (typeof slug !== 'string' || !getAdminProduct(slug)) return NextResponse.json({ error: 'Unknown product' }, { status: 404 });
  if (slot !== '1' && slot !== '2') return NextResponse.json({ error: 'Unknown image slot' }, { status: 400 });
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'That photo is too large' }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(bytes)) return NextResponse.json({ error: 'That file could not be read as an image' }, { status: 415 });

  const v = Date.now();
  const db = await getDb();
  await db
    .prepare('INSERT INTO media (key, type, bytes, v) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET type = excluded.type, bytes = excluded.bytes, v = excluded.v')
    .bind(`${slug}-${slot}`, 'image/webp', bytes, v)
    .run();
  await bumpStoreVersion();
  return NextResponse.json({ ok: true, url: `/media/${slug}-${slot}.webp?v=${v}`, v }, { headers: { 'Cache-Control': 'no-store' } });
}
