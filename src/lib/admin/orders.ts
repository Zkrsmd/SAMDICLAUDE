import 'server-only';
import { WILAYAS, wilayaName } from '@/data/delivery/wilayas';
import { ensureStore, getAdminProducts } from '@/lib/catalog';
import { readOverrides } from '@/lib/store/overrides';
import { listCodOrders, loadOrders, type CodOrder, type CodStatus } from '@/lib/store/orders';
import type { Fulfillment } from '@/lib/validation/admin';
import type { ConfirmBy, DeliveryMethod } from '@/lib/validation/order';

/**
 * Orders for the admin.
 *
 * - REAL orders from the website's cash-on-delivery checkout (src/lib/store/orders.ts).
 * - Until the first real order arrives, SAMPLE orders instead, so the dashboard, orders, customers
 *   and analytics have something real-shaped to show: generated the same on every load (seeded per
 *   day) from the live catalogue. They disappear by themselves once a real order comes in, so fake
 *   sales never mix with real ones.
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
  /** website customers: the mobile they ordered with */
  phone?: string;
  city: string;
  country: string;
}
/** cod: cash to collect on delivery · void: cancelled or returned, nothing collected */
export type Payment = 'paid' | 'pending' | 'refunded' | 'cod' | 'void';
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
  /** set on real website orders (cash on delivery); absent on sample orders */
  cod?: {
    status: CodStatus;
    firstName: string;
    lastName: string;
    phone: string;
    wilaya: number;
    wilayaName: string;
    commune: string;
    address: string;
    method: DeliveryMethod;
    confirm: ConfirmBy;
    note: string;
    history: { at: string; status: CodStatus }[];
  };
}

const FIRST = ['Lena', 'Omar', 'Sofia', 'Yusuf', 'Maya', 'Ilias', 'Nora', 'Karim', 'Elif', 'Jonas', 'Amira', 'Theo', 'Sara', 'Adam', 'Lina', 'Rayan', 'Mila', 'Noah', 'Ines', 'Samir', 'Hana', 'Lucas', 'Aya', 'Felix'];
const LAST = ['Berg', 'Haddad', 'Moreau', 'Kaya', 'Novak', 'Rossi', 'Amrani', 'Fischer', 'Silva', 'Jansen', 'Benali', 'Costa', 'Lindqvist', 'Mendes', 'Okafor', 'Duarte'];
/** sample customers live in the busiest wilayas */
const PLACES = [16, 31, 25, 19, 9, 35, 6, 15, 23, 5, 42, 13];

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
  const code = PLACES[Math.floor(r() * PLACES.length)]!;
  return { id: `c${1000 + i}`, name: `${first} ${last}`, email: `${first}.${last}${i}@example.com`.toLowerCase(), city: wilayaName(code), country: 'DZ' };
});

let memo: { key: string; orders: Order[] } | null = null;

const homeFee = (city: string) => (WILAYAS.find((w) => w.name === city)?.home ?? 800) * 100;

/** A real website order, shaped like every other order in the admin. */
function fromCod(c: CodOrder): Order {
  const name = `${c.firstName} ${c.lastName}`;
  const city = `${c.commune}, ${wilayaName(c.wilaya)}`;
  return {
    id: c.id,
    number: c.number,
    createdAt: c.createdAt,
    channel: 'Online store',
    customer: { id: `tel:${c.phone}`, name, email: '', phone: c.phone, city, country: 'DZ' },
    lines: c.lines.map((l) => ({ slug: l.slug, name: l.name, brandName: l.brandName, sport: l.sport, size: l.size, qty: l.qty, unit: l.unit, total: l.total, image: l.image })),
    items: c.lines.reduce((n, l) => n + l.qty, 0),
    subtotal: c.subtotal,
    shipping: c.delivery,
    tax: 0,
    total: c.total,
    payment: c.status === 'delivered' ? 'paid' : c.status === 'returned' || c.status === 'cancelled' ? 'void' : 'cod',
    fulfillment: ['new', 'no_answer', 'confirmed', 'preparing'].includes(c.status) ? 'unfulfilled' : 'fulfilled',
    archived: c.archived,
    notes: c.notes,
    cod: {
      status: c.status,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      wilaya: c.wilaya,
      wilayaName: wilayaName(c.wilaya),
      commune: c.commune,
      address: c.address,
      method: c.method,
      confirm: c.confirm,
      note: c.note,
      history: c.history,
    },
  };
}

/** true while the admin shows sample orders (no real order yet) */
/** Admin pages and actions: bring the store and the orders up to date before reading them. */
export async function loadAdminData() {
  await ensureStore();
  await loadOrders();
}

export const showingSamples = () => listCodOrders().length === 0;

/** Every order, newest first: the real ones, or (before the first real order) the samples. */
export function getOrders(): Order[] {
  const real = listCodOrders();
  return real.length ? real.map(fromCod) : sampleOrders();
}

/** Every sample order up to today, newest first, with the admin's saved changes applied. */
function sampleOrders(): Order[] {
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
      const shipping = homeFee(customer.city);
      const tax = 0;
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

const counted = (o: Order) => o.payment !== 'refunded' && o.payment !== 'void';

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
