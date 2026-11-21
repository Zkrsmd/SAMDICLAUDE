import { NextResponse } from 'next/server';
import { ensureStore, searchIndex } from '@/lib/catalog';

/** The instant-search index, loaded by the search overlay the first time it opens. */
export async function GET() {
  await ensureStore();
  return NextResponse.json(searchIndex(), { headers: { 'Cache-Control': 'public, max-age=120' } });
}
