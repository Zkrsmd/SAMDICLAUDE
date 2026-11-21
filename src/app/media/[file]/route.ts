import { getDb } from '@/lib/store/db';

/**
 * Product photos uploaded in the admin (kept in the database). URLs carry ?v=<version>, so a
 * new upload gets a new URL and each file can be cached for good.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*-[12])\.webp$/.exec(file);
  if (!m) return new Response('Not found', { status: 404 });
  const db = await getDb();
  const row = await db.prepare('SELECT type, bytes FROM media WHERE key = ?').bind(m[1]).first<{ type: string; bytes: ArrayBuffer | number[] }>();
  if (!row) return new Response('Not found', { status: 404 });
  const body = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes);
  return new Response(body, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
