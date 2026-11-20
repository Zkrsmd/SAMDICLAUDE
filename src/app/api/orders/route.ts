import { NextResponse } from 'next/server';
import { brandName } from '@/data/brands';
import { sports } from '@/data/categories';
import { getProduct, sizeAvailable } from '@/lib/catalog';
import { deliveryFee } from '@/lib/delivery';
import { renderUrl } from '@/lib/format';
import { clientKey, rateLimit } from '@/lib/security/rateLimit';
import { ReadOnlyStoreError, storeWritable } from '@/lib/store/overrides';
import { StockError, placeOrder, type CodLine } from '@/lib/store/orders';
import { CheckoutSchema } from '@/lib/validation/order';
import { fieldErrors } from '@/lib/validation/admin';

const MAX_BODY = 16 * 1024;

export interface OrderResponse {
  ok: boolean;
  /** order number to show the customer (absent when nothing was saved) */
  number?: number;
  error?: string;
  fields?: Record<string, string>;
}

const no = (status: number, error: string, fields?: Record<string, string>) => NextResponse.json<OrderResponse>({ ok: false, error, fields }, { status });

/**
 * Places a cash-on-delivery order. The browser sends who, where and which items; the server prices
 * every line from the catalogue, adds the delivery price for the wilaya, checks stock, saves the
 * order and takes the units off the shelf. Nothing about payment is handled here: the customer pays
 * the courier in cash.
 */
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    let same = false;
    try {
      same = new URL(origin).host === host;
    } catch {
      same = false;
    }
    if (!same) return no(403, 'Cross-origin request rejected');
  }
  if (!req.headers.get('content-type')?.includes('application/json')) return no(415, 'Expected JSON');
  if (Number(req.headers.get('content-length') ?? '0') > MAX_BODY) return no(413, 'Payload too large');
  const text = await req.text();
  if (text.length > MAX_BODY) return no(413, 'Payload too large');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return no(400, 'Invalid JSON');
  }
  const parsed = CheckoutSchema.safeParse(json);
  if (!parsed.success) return no(400, 'Some details need attention.', fieldErrors(parsed.error));
  const f = parsed.data;
  // the honeypot was filled in: a bot. Answer like a success, save nothing.
  if (f.website) return NextResponse.json<OrderResponse>({ ok: true }, { status: 202 });
  // fake-order protection: a few complete orders per connection per 10 minutes (counted only once the
  // form is valid: mobile networks put many customers behind one address, typos must not lock them out)
  if (!rateLimit(`order:${clientKey(req.headers)}`, 6, 10 * 60_000).ok) return no(429, 'Too many orders from this connection. Call us to order, or try again in a few minutes.');
  if (!storeWritable()) return no(503, 'Online ordering isn’t open on this preview yet.');

  // same product + colour + size twice → one line
  const merged = new Map<string, { productId: string; colorId: string; size: string; qty: number }>();
  for (const it of f.items) {
    const k = `${it.productId}::${it.colorId}::${it.size}`;
    const cur = merged.get(k);
    merged.set(k, cur ? { ...cur, qty: Math.min(20, cur.qty + it.qty) } : it);
  }

  const lines: CodLine[] = [];
  const problems: string[] = [];
  for (const it of merged.values()) {
    const p = getProduct(it.productId);
    const color = p?.colors.find((c) => c.id === it.colorId);
    if (!p || !color || !p.sizes.includes(it.size)) {
      problems.push('An item in your bag is no longer available');
      continue;
    }
    if (p.comingSoon) {
      problems.push(`${p.name} is coming soon and can’t be ordered yet`);
      continue;
    }
    const left = p.stock ? (p.stock[it.size] ?? 0) : Infinity;
    if (!sizeAvailable(p, it.size) || left < it.qty) {
      problems.push(left > 0 && left < it.qty ? `${p.name} (${it.size}): only ${left} left` : `${p.name} (${it.size}) is out of stock`);
      continue;
    }
    lines.push({
      slug: p.slug,
      name: p.name,
      brandName: brandName(p.brand),
      sport: sports.find((s) => s.slug === p.sport)?.name ?? p.sport,
      colorId: color.id,
      colorName: color.name,
      size: it.size,
      qty: it.qty,
      unit: p.price,
      total: p.price * it.qty,
      image: renderUrl(p.slug),
      stockTaken: !!p.stock,
    });
  }
  if (problems.length) return no(409, `${problems.join('. ')}. Update your bag and try again.`);

  const delivery = deliveryFee(f.wilaya, f.method);
  if (delivery === null)
    return no(400, 'Some details need attention.', { method: f.method === 'desk' ? 'No stop desk in this wilaya: choose home delivery' : 'Home delivery isn’t offered in this wilaya' });
  const subtotal = lines.reduce((n, l) => n + l.total, 0);

  try {
    const o = await placeOrder({
      firstName: f.firstName,
      lastName: f.lastName,
      phone: f.phone,
      wilaya: f.wilaya,
      commune: f.commune,
      address: f.address,
      method: f.method,
      confirm: f.confirm,
      note: f.note,
      lines,
      subtotal,
      delivery,
      total: subtotal + delivery,
    });
    return NextResponse.json<OrderResponse>({ ok: true, number: o.number }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof StockError) return no(409, `${e.message}. Update your bag and try again.`);
    if (e instanceof ReadOnlyStoreError) return no(503, 'Online ordering isn’t open on this preview yet.');
    console.error('[orders] could not save an order', e);
    return no(500, 'Your order could not be saved. Please try again, or call us.');
  }
}
