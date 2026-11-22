import 'server-only';
import { z } from 'zod';
import { getAdminProduct } from '@/lib/catalog';
import { CONFIRM_BY, DELIVERY_METHODS } from '@/lib/validation/order';
import { getDb, randomToken, sha256 } from './db';
import { updateOverrides } from './overrides';
import { patchProduct } from './product-patch';
import { recordOrder } from './copurchase';

/**
 * Real orders from the website's cash-on-delivery checkout, in the database (D1 `orders`).
 *
 * They hold customers' names, phone numbers and addresses: only the admin can list them, and a
 * customer can only open their own order through the private receipt link they get when ordering
 * (a 256-bit random token; the database keeps only its SHA-256, so the table alone can't be turned
 * into links). Order numbers are sequential and never enough to open anything.
 *
 * Stock: placing an order takes its units off the shelf (only for products whose stock is tracked);
 * cancelling it or marking it returned puts them back.
 */

import { COD_STATUS, OFF_SHELF as OFF, type CodStatus } from '@/lib/order-status';
export { COD_STATUS, type CodStatus };

const money = z.number().int().min(0).max(10_000_000_000);
const LineSchema = z.object({
  slug: z.string(),
  name: z.string(),
  brandName: z.string(),
  sport: z.string(),
  colorId: z.string(),
  colorName: z.string(),
  size: z.string(),
  qty: z.number().int().min(1),
  unit: money,
  total: money,
  image: z.string(),
  /** true when this line's units were taken off tracked stock */
  stockTaken: z.boolean(),
});
export type CodLine = z.infer<typeof LineSchema>;

const CodOrderSchema = z.object({
  id: z.string().regex(/^w\d{5,7}$/),
  number: z.number().int(),
  createdAt: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string(),
  wilaya: z.number().int().min(1).max(58),
  commune: z.string(),
  address: z.string(),
  method: z.enum(DELIVERY_METHODS),
  confirm: z.enum(CONFIRM_BY),
  note: z.string(),
  lines: z.array(LineSchema).min(1),
  subtotal: money,
  delivery: money,
  total: money,
  status: z.enum(COD_STATUS),
  archived: z.boolean(),
  notes: z.array(z.object({ at: z.string(), text: z.string() })),
  history: z.array(z.object({ at: z.string(), status: z.enum(COD_STATUS) })),
});
export type CodOrder = z.infer<typeof CodOrderSchema>;

/** website order numbers start here, well clear of the sample orders (#1001…) */
const FIRST_NUMBER = 10001;

export class StockError extends Error {}

const parse = (data: string): CodOrder | null => {
  try {
    const r = CodOrderSchema.safeParse(JSON.parse(data));
    if (r.success) return r.data;
  } catch {
    /* fall through */
  }
  console.error('[orders] an order row does not validate');
  return null;
};

let loaded: CodOrder[] = [];

/** Read every order (admin pages call this before using the sync helpers below). */
export async function loadOrders(): Promise<CodOrder[]> {
  const db = await getDb();
  const { results } = await db.prepare('SELECT data FROM orders ORDER BY number DESC').all<{ data: string }>();
  loaded = (results ?? []).map((r) => parse(r.data)).filter((o): o is CodOrder => !!o);
  return loaded;
}

/** Newest first (as loaded by the last `loadOrders()`). */
export const listCodOrders = (): CodOrder[] => loaded;
export const getCodOrder = (id: string) => loaded.find((o) => o.id === id);

async function fetchOrder(id: string): Promise<CodOrder | null> {
  const db = await getDb();
  const row = await db.prepare('SELECT data FROM orders WHERE id = ?').bind(id).first<{ data: string }>();
  return row ? parse(row.data) : null;
}

async function saveOrder(o: CodOrder) {
  const db = await getDb();
  await db.prepare('UPDATE orders SET status = ?, archived = ?, data = ? WHERE id = ?').bind(o.status, o.archived ? 1 : 0, JSON.stringify(o), o.id).run();
}

/** Take (-1) or put back (+1) the tracked units of these lines. Throws StockError when a size runs short. */
async function moveStock(lines: CodLine[], sign: 1 | -1) {
  const tracked = lines.filter((l) => l.stockTaken);
  if (!tracked.length) return;
  await updateOverrides((d) => {
    for (const l of tracked) {
      const p = getAdminProduct(l.slug);
      if (!p || !p.sizes.includes(l.size)) continue; // deleted since: nothing to put back
      patchProduct(d, p, (input) => {
        const have = input.stock[l.size] ?? 0;
        if (sign < 0 && have < l.qty) throw new StockError(`${p.name} (${l.size}): only ${have} left`);
        return { ...input, stock: { ...input.stock, [l.size]: have + sign * l.qty } };
      });
    }
  });
}

export type NewOrder = Omit<CodOrder, 'id' | 'number' | 'createdAt' | 'status' | 'archived' | 'notes' | 'history'>;

/**
 * Save a new order (lines already priced by the server) and take its units off the shelf.
 * Returns the order and the customer's private receipt token (shown once, never stored).
 */
export async function placeOrder(order: NewOrder, client: string): Promise<{ order: CodOrder; token: string }> {
  const db = await getDb();
  await moveStock(order.lines, -1);
  const token = randomToken();
  try {
    const receipt = await sha256(token);
    const at = new Date().toISOString();
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await db.prepare('SELECT MAX(number) AS n FROM orders').first<{ n: number | null }>();
      const number = Math.max(FIRST_NUMBER, (last?.n ?? FIRST_NUMBER - 1) + 1);
      const saved: CodOrder = { ...order, id: `w${number}`, number, createdAt: at, status: 'new', archived: false, notes: [], history: [{ at, status: 'new' }] };
      try {
        await db
          .prepare('INSERT INTO orders (id, number, created_at, status, archived, receipt, client, data) VALUES (?, ?, ?, ?, 0, ?, ?, ?)')
          .bind(saved.id, number, at, 'new', receipt, client, JSON.stringify(CodOrderSchema.parse(saved)))
          .run();
        // what was bought together feeds "Complete the look" (never fails the order)
        await recordOrder(saved.lines.map((l) => l.slug));
        return { order: saved, token };
      } catch (e) {
        // two orders took the same number at once: take the next one
        if (!/UNIQUE/i.test(String((e as Error).message))) throw e;
      }
    }
    throw new Error('Could not number the order');
  } catch (e) {
    // the order didn't save: give the units back
    await moveStock(order.lines, 1).catch(() => undefined);
    throw e;
  }
}

/** The order behind a receipt link, or null. */
export async function getOrderByReceipt(token: string): Promise<CodOrder | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return null;
  const db = await getDb();
  const row = await db.prepare('SELECT data FROM orders WHERE receipt = ?').bind(await sha256(token)).first<{ data: string }>();
  return row ? parse(row.data) : null;
}

/** Move an order along (new → [no answer →] confirmed → preparing → shipped → delivered, or cancelled / returned). */
export async function setCodStatus(id: string, status: CodStatus) {
  const o = await fetchOrder(id);
  if (!o) throw new Error('This order no longer exists.');
  if (o.status === status) return;
  const wasOff = OFF.has(o.status);
  const nowOff = OFF.has(status);
  if (!wasOff && nowOff) await moveStock(o.lines, 1);
  if (wasOff && !nowOff) await moveStock(o.lines, -1);
  o.status = status;
  o.history.push({ at: new Date().toISOString(), status });
  await saveOrder(o);
}

export async function patchCodOrders(ids: string[], patch: { archived?: boolean }) {
  if (typeof patch.archived !== 'boolean') return;
  for (const id of ids) {
    const o = await fetchOrder(id);
    if (!o) continue;
    o.archived = patch.archived;
    await saveOrder(o);
  }
}

/** What the admin can correct on an order: the customer's details and how it's delivered. */
export interface CustomerPatch {
  firstName: string;
  lastName: string;
  phone: string;
  wilaya: number;
  commune: string;
  method: CodOrder['method'];
  note: string;
}

/**
 * Correct an order's customer details. The delivery price follows the wilaya and the delivery
 * kind (today's price list), and the total with it. The change is written in the order's notes.
 */
export async function updateCodCustomer(id: string, patch: CustomerPatch, deliveryFee: (wilaya: number, method: CodOrder['method']) => number | null) {
  const o = await fetchOrder(id);
  if (!o) throw new Error('This order no longer exists.');
  const changed: string[] = [];
  const name = `${patch.firstName} ${patch.lastName}`.trim();
  if (name !== `${o.firstName} ${o.lastName}`.trim()) changed.push(`name → ${name}`);
  if (patch.phone !== o.phone) changed.push(`phone → ${patch.phone}`);
  if (patch.wilaya !== o.wilaya || patch.commune !== o.commune) changed.push(`place → ${patch.commune}, wilaya ${patch.wilaya}`);
  if (patch.method !== o.method) changed.push(`delivery → ${patch.method === 'home' ? 'home' : 'stop desk'}`);
  if (patch.note !== o.note) changed.push('customer note edited');
  if (!changed.length) return o;
  if (patch.wilaya !== o.wilaya || patch.method !== o.method) {
    const fee = deliveryFee(patch.wilaya, patch.method);
    if (fee === null) throw new Error('That delivery is not offered in this wilaya.');
    o.delivery = fee;
    o.total = o.subtotal + fee;
  }
  Object.assign(o, patch);
  o.notes = [...o.notes, { at: new Date().toISOString(), text: `Details corrected: ${changed.join(' · ')}` }].slice(-100);
  await saveOrder(o);
  return o;
}

/** A customer's name and phone, changed on every order they placed (customers are known by their phone). */
export async function renameCustomer(phone: string, next: { firstName: string; lastName: string; phone: string }) {
  const all = await loadOrders();
  const mine = all.filter((o) => o.phone === phone);
  for (const o of mine) {
    const fresh = await fetchOrder(o.id);
    if (!fresh) continue;
    fresh.firstName = next.firstName;
    fresh.lastName = next.lastName;
    fresh.phone = next.phone;
    await saveOrder(fresh);
  }
  return mine.length;
}

export async function addCodNote(id: string, text: string) {
  const o = await fetchOrder(id);
  if (!o) return;
  o.notes = [...o.notes, { at: new Date().toISOString(), text }].slice(-100);
  await saveOrder(o);
}
