import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { ADMIN_COOKIE, verifyToken } from '@/lib/admin/auth';
import { getAdminProduct } from '@/lib/catalog';
import { storeWritable } from '@/lib/store/overrides';
import { clientKey, rateLimit } from '@/lib/security/rateLimit';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Product photo upload (admin only): the image is re-encoded by sharp (anything that is not a real
 * image fails here), fitted inside 1600px and saved as /products/<slug>-<1|2>.webp — the same path
 * the storefront reads. Cut-outs on a transparent background look best (npm run cutout).
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
  if (!rateLimit(`admin-media:${clientKey(req.headers)}`, 30).ok) return NextResponse.json({ error: 'Too many uploads' }, { status: 429 });
  if (!storeWritable()) return NextResponse.json({ error: 'This deployment is read-only' }, { status: 503 });
  if (Number(req.headers.get('content-length') ?? '0') > MAX_BYTES + 64 * 1024)
    return NextResponse.json({ error: 'Images up to 8 MB' }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a file upload' }, { status: 400 });
  }
  const slug = form.get('slug');
  const slot = form.get('slot');
  const file = form.get('file');
  if (typeof slug !== 'string' || !getAdminProduct(slug)) return NextResponse.json({ error: 'Unknown product' }, { status: 404 });
  if (slot !== '1' && slot !== '2') return NextResponse.json({ error: 'Unknown image slot' }, { status: 400 });
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: 'Images up to 8 MB' }, { status: 413 });
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/avif'].includes(file.type))
    return NextResponse.json({ error: 'Use a PNG, JPG, WebP or AVIF image' }, { status: 415 });

  let out: Buffer;
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 95 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'That file could not be read as an image' }, { status: 415 });
  }
  // the slug was checked against the catalogue above, so the path stays inside public/products
  const target = path.join(process.cwd(), 'public', 'products', `${slug}-${slot}.webp`);
  await fs.writeFile(target, out);
  return NextResponse.json({ ok: true, url: `/products/${slug}-${slot}.webp`, v: Date.now() }, { headers: { 'Cache-Control': 'no-store' } });
}
