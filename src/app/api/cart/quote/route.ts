import { NextResponse } from 'next/server';
import { getProduct } from '@/lib/catalog';
import { brandName } from '@/data/brands';
import { CartQuoteRequestSchema } from '@/lib/validation/catalog';
import { clientKey, rateLimit } from '@/lib/security/rateLimit';

const MAX_BODY = 16 * 1024;

export interface QuoteLine {
  key: string;
  slug: string;
  name: string;
  brandName: string;
  colorId: string;
  colorName: string;
  size: string;
  qty: number;
  unit: number;
  total: number;
}
export interface QuoteResponse {
  lines: QuoteLine[];
  rejected: { key: string; reason: string }[];
  subtotal: number;
  currency: string;
}

/**
 * Prices the cart from the trusted catalogue. The client only sends ids, variants and
 * quantities; any price-like fields are ignored by schema validation.
 */
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false; // e.g. "Origin: null"
    }
    if (!sameOrigin) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  if (!rateLimit(`quote:${clientKey(req.headers)}`, 120).ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 415 });
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = CartQuoteRequestSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid cart' }, { status: 400 });

  const lines: QuoteLine[] = [];
  const rejected: QuoteResponse['rejected'] = [];
  for (const item of parsed.data.items) {
    const key = `${item.productId}::${item.colorId}::${item.size}`;
    const p = getProduct(item.productId);
    const color = p?.colors.find((c) => c.id === item.colorId);
    if (!p) {
      rejected.push({ key, reason: 'Product no longer available' });
      continue;
    }
    if (!color || !p.sizes.includes(item.size)) {
      rejected.push({ key, reason: 'Variant no longer available' });
      continue;
    }
    lines.push({
      key,
      slug: p.slug,
      name: p.name,
      brandName: brandName(p.brand),
      colorId: color.id,
      colorName: color.name,
      size: item.size,
      qty: item.qty,
      unit: p.price,
      total: p.price * item.qty,
    });
  }
  const body: QuoteResponse = {
    lines,
    rejected,
    subtotal: lines.reduce((n, l) => n + l.total, 0),
    currency: 'EUR',
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
