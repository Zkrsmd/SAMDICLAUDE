import { NextResponse } from 'next/server';
import { ensureStore, getProduct, productsFor, applyListing, toCard, getSport } from '@/lib/catalog';
import type { SportSlug } from '@/types/catalog';

/**
 * Product cards on demand, so pages don't carry the whole catalogue:
 *   ?s=slug,slug,…  (recently viewed, wishlist — at most 60)
 *   ?sport=football (every card of one sport, for the homepage "shop by sport" panel)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  await ensureStore();
  const headers = { 'Cache-Control': 'public, max-age=60' };
  const sport = url.searchParams.get('sport');
  if (sport) {
    if (!/^[a-z-]{2,32}$/.test(sport) || !getSport(sport)) return NextResponse.json([], { status: 404 });
    const list = applyListing(productsFor(sport as SportSlug), { q: '', brand: [], color: [], size: [], min: undefined, max: undefined, sort: 'featured' });
    return NextResponse.json(list.map(toCard), { headers });
  }
  const slugs = (url.searchParams.get('s') ?? '')
    .split(',')
    .filter((s) => /^[a-z0-9-]{1,96}$/.test(s))
    .slice(0, 60);
  const cards = slugs.map((s) => getProduct(s)).filter((p) => !!p).map((p) => toCard(p!));
  return NextResponse.json(cards, { headers });
}
