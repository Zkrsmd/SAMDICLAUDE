import 'server-only';
import { getAdminProducts } from '@/lib/catalog';
import { readOverrides } from '@/lib/store/overrides';
import type { Fulfillment } from '@/lib/validation/admin';

/**
 * SAMPLE orders, so the dashboard, orders, customers and analytics have something real-shaped to
 * show. The store takes no orders yet (the checkout is a demonstration), so these are generated:
 * the same orders on every load (seeded per day), from the live catalogue. Fulfilment, archive and
 * notes you set in the admin are saved for real (store file → orders).
 */

export interface OrderLine {
  slug: string;
  name: string;
  brandName: string;
  sport: string;
  size: string;
  qty: number;
  unit: number;
  total: number;
  image: string;
}
export interface Customer {
  id: string;
  name: string;
  email: string;
  city: string;
  country: string;
}
export type Payment = 'paid' | 'pending' | 'refunded';
export interface Order {
  id: string;
  number: number;
  createdAt: string;
  channel: 'Online store' | 'Instagram' | 'TikTok';
  customer: Customer;
  lines: OrderLine[];
  items: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  payment: Payment;
  fulfillment: Fulfillment;
  archived: boolean;
  notes: { at: string; text: string }[];
}

const FIRST = ['Lena', 'Omar', 'Sofia', 'Yusuf', 'Maya', 'Ilias', 'Nora', 'Karim', 'Elif', 'Jonas', 'Amira', 'Theo', 'Sara', 'Adam', 'Lina', 'Rayan', 'Mila', 'Noah', 'Ines', 'Samir', 'Hana', 'Lucas', 'Aya', 'Felix'];
const LAST = ['Berg', 'Haddad', 'Moreau', 'Kaya', 'Novak', 'Rossi', 'Amrani', 'Fischer', 'Silva', 'Jansen', 'Benali', 'Costa', 'Lindqvist', 'Mendes', 'Okafor', 'Duarte'];
const PLACES: [string, string][] = [
  ['Amsterdam', 'NL'], ['Lyon', 'FR'], ['Berlin', 'DE'], ['Madrid', 'ES'], ['Milan', 'IT'], ['Brussels', 'BE'], ['Lisbon', 'PT'],
  ['Stockholm', 'SE'], ['Vienna', 'AT'], ['Casablanca', 'MA'], ['Dublin', 'IE'], ['Copenhagen', 'DK'],
];

const DAY = 86_400_000;
/** the first sample day (order numbers count up from #1001 here) */
const EPOCH = Date.UTC(2026, 6, 1);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const customers: Customer[] = Array.from({ length: 64 }, (_, i) => {
  const r = rng(9000 + i);
  const first = FIRST[Math.floor(r() * FIRST.length)]!;
  const last = LAST[Math.floor(r() * LAST.length)]!;
  const [city, country] = PLACES[Math.floor(r() * PLACES.length)]!;
  return { id: `c${1000 + i}`, name: `${first} ${last}`, email: `${first}.${last}${i}@example.com`.toLowerCase(), city, country };
});

let memo: { key: string; orders: Order[] } | null = null;

/** Every sample order up to today, newest first, with the admin's saved changes applied. */
export function getOrders(): Order[] {
  const o = readOverrides();
  const today = Math.floor(Date.now() / DAY) * DAY;
  const products = getAdminProducts().filter((p) => p.status !== 'archived');
  const now = Date.now();
  const key = `${Math.floor(now / 3_600_000)}|${o.updatedAt}|${products.length}`;
  if (memo?.key === key) return memo.orders;

  // best sellers sell more: weight the draw
  const pool = products.flatMap((p) => (p.bestSeller ? [p, p, p, p] : [p]));
  const out: Order[] = [];
  let number = 1001;
  for (let day = EPOCH; day <= today && pool.length; day += DAY) {
    const r = rng(day / DAY);
    const age = (today - day) / DAY;
    const weekend = [0, 6].includes(new Date(day).getUTCDay());
    // busier lately and at weekends
    const count = Math.floor(1 + r() * 3 + (weekend ? 1.5 : 0) + Math.max(0, 2 - age / 30));
    for (let k = 0; k < count; k++) {
      const customer = customers[Math.floor(r() * (r() < 0.35 ? 12 : customers.length))]!;
      const n = r() < 0.62 ? 1 : r() < 0.8 ? 2 : 3;
      const lines: OrderLine[] = [];
      for (let j = 0; j < n; j++) {
        const p = pool[Math.floor(r() * pool.length)]!;
        if (lines.some((l) => l.slug === p.slug)) continue;
        const qty = r() < 0.86 ? 1 : 2;
        lines.push({
          slug: p.slug,
          name: p.name,
          brandName: p.brandName,
          sport: p.sportName,
          size: p.sizes[Math.floor(r() * p.sizes.length)] ?? 'One size',
          qty,
          unit: p.price,
          total: p.price * qty,
          image: p.image,
        });
      }
      const subtotal = lines.reduce((s, l) => s + l.total, 0);
      const shipping = subtotal >= 15000 ? 0 : 695;
      const tax = Math.round(subtotal * 0.08);
      const at = day + Math.floor((8 + r() * 14) * 3_600_000);
      // later today hasn't happened yet: keep the order number, skip the order
      if (at > now) {
        number++;
        continue;
      }
      const id = `o${number}`;
      const saved = o.orders[id];
      const refunded = age > 4 && r() < 0.025;
      out.push({
        id,
        number,
        createdAt: new Date(at).toISOString(),
        channel: r() < 0.74 ? 'Online store' : r() < 0.6 ? 'Instagram' : 'TikTok',
        customer,
        lines,
        items: lines.reduce((s, l) => s + l.qty, 0),
        subtotal,
        shipping,
        tax,
        total: subtotal + shipping + tax,
        payment: refunded ? 'refunded' : age < 2 && r() < 0.3 ? 'pending' : 'paid',
        fulfillment: saved?.fulfillment ?? (age > 3 || refunded ? 'fulfilled' : 'unfulfilled'),
        archived: saved?.archived ?? false,
        notes: saved?.notes ?? [],
      });
      number++;
    }
  }
  out.reverse();
  memo = { key, orders: out };
  return out;
}

export const getOrder = (id: string) => getOrders().find((o) => o.id === id);

/* ------------------------------- reporting ------------------------------- */

export const RANGES = { '7': 7, '30': 30, '90': 90 } as const;
export type RangeKey = keyof typeof RANGES;
export const parseRange = (v: unknown): RangeKey => (typeof v === 'string' && v in RANGES ? (v as RangeKey) : '30');

const counted = (o: Order) => o.payment !== 'refunded';

export function report(days: number) {
  const orders = getOrders();
  const end = Math.floor(Date.now() / DAY) * DAY + DAY;
  const start = end - days * DAY;
  const prevStart = start - days * DAY;
  const inRange = orders.filter((o) => +new Date(o.createdAt) >= start && counted(o));
  const prev = orders.filter((o) => +new Date(o.createdAt) >= prevStart && +new Date(o.createdAt) < start && counted(o));
  const sum = (l: Order[], f: (o: Order) => number) => l.reduce((s, o) => s + f(o), 0);
  const series = Array.from({ length: days }, (_, i) => {
    const d0 = start + i * DAY;
    const list = inRange.filter((o) => +new Date(o.createdAt) >= d0 && +new Date(o.createdAt) < d0 + DAY);
    return { date: new Date(d0).toISOString().slice(0, 10), sales: sum(list, (o) => o.total), orders: list.length };
  });
  const change = (a: number, b: number) => (b ? (a - b) / b : null);
  const sales = sum(inRange, (o) => o.total);
  const count = inRange.length;
  const items = sum(inRange, (o) => o.items);
  const by = (f: (l: OrderLine) => string) => {
    const m = new Map<string, number>();
    for (const o of inRange) for (const l of o.lines) m.set(f(l), (m.get(f(l)) ?? 0) + l.total);
    return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const products = new Map<string, { slug: string; name: string; image: string; brandName: string; units: number; sales: number }>();
  for (const o of inRange)
    for (const l of o.lines) {
      const p = products.get(l.slug) ?? { slug: l.slug, name: l.name, image: l.image, brandName: l.brandName, units: 0, sales: 0 };
      p.units += l.qty;
      p.sales += l.total;
      products.set(l.slug, p);
    }
  const channels = new Map<string, number>();
  for (const o of inRange) channels.set(o.channel, (channels.get(o.channel) ?? 0) + o.total);
  const buyers = new Map<string, number>();
  for (const o of orders) if (+new Date(o.createdAt) < end) buyers.set(o.customer.id, (buyers.get(o.customer.id) ?? 0) + 1);
  const returning = new Set(inRange.filter((o) => (buyers.get(o.customer.id) ?? 0) > 1).map((o) => o.customer.id)).size;
  const uniq = new Set(inRange.map((o) => o.customer.id)).size;
  return {
    days,
    series,
    sales,
    orders: count,
    items,
    aov: count ? Math.round(sales / count) : 0,
    returningRate: uniq ? returning / uniq : 0,
    delta: {
      sales: change(sales, sum(prev, (o) => o.total)),
      orders: change(count, prev.length),
      aov: change(count ? sales / count : 0, prev.length ? sum(prev, (o) => o.total) / prev.length : 0),
      items: change(items, sum(prev, (o) => o.items)),
    },
    bySport: by((l) => l.sport),
    byBrand: by((l) => l.brandName),
    byChannel: [...channels].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    topProducts: [...products.values()].sort((a, b) => b.sales - a.sales).slice(0, 8),
  };
}
export type Report = ReturnType<typeof report>;

export function getCustomers() {
  const m = new Map<string, Customer & { orders: number; spent: number; last: string; first: string }>();
  for (const o of getOrders()) {
    const c = m.get(o.customer.id) ?? { ...o.customer, orders: 0, spent: 0, last: o.createdAt, first: o.createdAt };
    c.orders++;
    if (counted(o)) c.spent += o.total;
    if (o.createdAt > c.last) c.last = o.createdAt;
    if (o.createdAt < c.first) c.first = o.createdAt;
    m.set(o.customer.id, c);
  }
  return [...m.values()].sort((a, b) => b.spent - a.spent);
}
export type CustomerRow = ReturnType<typeof getCustomers>[number];
