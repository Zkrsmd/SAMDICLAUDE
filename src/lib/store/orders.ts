import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getAdminProduct } from '@/lib/catalog';
import { CONFIRM_BY, DELIVERY_METHODS } from '@/lib/validation/order';
import { ReadOnlyStoreError, storeWritable, updateOverrides } from './overrides';
import { patchProduct } from './product-patch';

/**
 * Real orders from the website's cash-on-delivery checkout.
 *
 * They hold customers' names, phone numbers and addresses, so they are kept OUT of git: in
 * `.data/orders.json` (git-ignored), next to the project. Back that folder up. When the store moves
 * to its own host this file becomes a database table; nothing else needs to change.
 *
 * Stock: placing an order takes its units off the shelf (only for products whose stock is tracked,
 * i.e. saved in the admin at least once). Cancelling it or marking it returned puts them back.
 */

export const COD_STATUS = ['new', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled'] as const;
export type CodStatus = (typeof COD_STATUS)[number];
/** statuses where the goods are back on the shelf */
const OFF = new Set<CodStatus>(['returned', 'cancelled']);

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

const FileSchema = z.object({ version: z.literal(1), next: z.number().int(), orders: z.array(CodOrderSchema) });
type OrdersFile = z.infer<typeof FileSchema>;

const DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'orders.json');
/** website order numbers start here, well clear of the sample orders (#1001…) */
const FIRST_NUMBER = 10001;
const EMPTY: OrdersFile = { version: 1, next: FIRST_NUMBER, orders: [] };

export class StockError extends Error {}

let cache: { mtime: number; size: number; data: OrdersFile } | null = null;

function readFile(): OrdersFile {
  try {
    const st = fs.statSync(FILE);
    if (cache && cache.mtime === st.mtimeMs && cache.size === st.size) return cache.data;
    const parsed = FileSchema.safeParse(JSON.parse(fs.readFileSync(FILE, 'utf8')));
    if (!parsed.success) {
      // never lose orders silently: keep serving the last good copy and say so
      console.error('[orders] .data/orders.json does not validate; fix it by hand. Using the last good copy.');
      return cache?.data ?? EMPTY;
    }
    cache = { mtime: st.mtimeMs, size: st.size, data: parsed.data };
    return parsed.data;
  } catch {
    return cache?.data ?? EMPTY;
  }
}

let queue: Promise<unknown> = Promise.resolve();
function writeFile<T>(change: (draft: OrdersFile) => T): Promise<T> {
  const run = queue.then(() => {
    if (!storeWritable()) throw new ReadOnlyStoreError();
    const draft = structuredClone(readFile());
    const out = change(draft);
    const next = FileSchema.parse(draft);
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    fs.renameSync(tmp, FILE);
    cache = null;
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Newest first. */
export const listCodOrders = (): CodOrder[] => [...readFile().orders].reverse();
export const getCodOrder = (id: string) => readFile().orders.find((o) => o.id === id);

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

/** Save a new order (lines already priced by the server) and take its units off the shelf. */
export async function placeOrder(order: NewOrder): Promise<CodOrder> {
  if (!storeWritable()) throw new ReadOnlyStoreError();
  await moveStock(order.lines, -1);
  try {
    return await writeFile((d) => {
      const number = d.next;
      const at = new Date().toISOString();
      const saved: CodOrder = { ...order, id: `w${number}`, number, createdAt: at, status: 'new', archived: false, notes: [], history: [{ at, status: 'new' }] };
      d.orders.push(saved);
      d.next = number + 1;
      return saved;
    });
  } catch (e) {
    // the order didn't save: give the units back
    await moveStock(order.lines, 1).catch(() => undefined);
    throw e;
  }
}

/** Move an order along (new → confirmed → shipped → delivered, or cancelled / returned). */
export async function setCodStatus(id: string, status: CodStatus) {
  const o = getCodOrder(id);
  if (!o) throw new Error('This order no longer exists.');
  if (o.status === status) return;
  const wasOff = OFF.has(o.status);
  const nowOff = OFF.has(status);
  if (!wasOff && nowOff) await moveStock(o.lines, 1);
  if (wasOff && !nowOff) await moveStock(o.lines, -1);
  await writeFile((d) => {
    const x = d.orders.find((y) => y.id === id);
    if (!x) return;
    x.status = status;
    x.history.push({ at: new Date().toISOString(), status });
  });
}

export const patchCodOrders = (ids: string[], patch: { archived?: boolean }) =>
  writeFile((d) => {
    for (const o of d.orders) if (ids.includes(o.id) && typeof patch.archived === 'boolean') o.archived = patch.archived;
  });

export const addCodNote = (id: string, text: string) =>
  writeFile((d) => {
    const o = d.orders.find((y) => y.id === id);
    if (o) o.notes = [...o.notes, { at: new Date().toISOString(), text }].slice(-100);
  });
