'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { checkPassword, endSession, isAdmin, startSession } from '@/lib/admin/auth';
import { getAdminProduct, getAdminProducts, isCatalogSlug } from '@/lib/catalog';
import { getOrder } from '@/lib/admin/orders';
import { clientKey, rateLimit } from '@/lib/security/rateLimit';
import { ReadOnlyStoreError, replaceOverrides, toDinars, updateOverrides } from '@/lib/store/overrides';
import { inputOf, patchProduct } from '@/lib/store/product-patch';
import { COD_STATUS, StockError, addCodNote, getCodOrder, patchCodOrders, setCodStatus, type CodStatus } from '@/lib/store/orders';
import { WILAYAS } from '@/data/delivery/wilayas';
import {
  BulkSchema,
  DeliverySchema,
  EMPTY_OVERRIDES,
  FULFILLMENT,
  InventorySchema,
  OverridesSchema,
  ProductInputSchema,
  fieldErrors,
  type ActionResult,
  type BulkAction,
  type Overrides,
  type ProductInput,
} from '@/lib/validation/admin';

/**
 * Every admin write. Each action checks the session itself (actions are public POST endpoints),
 * validates its input with the same schemas the editor uses, writes the store file, and refreshes
 * the storefront so the change shows on the next page view.
 */

const fail = (error: string, fields?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fields });

async function guard() {
  if (!(await isAdmin())) return fail('Your session has ended. Sign in again.');
  return null;
}

async function write(change: (d: Overrides) => void) {
  try {
    await updateOverrides(change);
  } catch (e) {
    if (e instanceof ReadOnlyStoreError) return fail(e.message);
    console.error('[admin] save failed', e);
    return fail('Could not save. Check the server log.');
  }
  // the whole storefront reads the catalogue: refresh every page
  revalidatePath('/', 'layout');
  return null;
}

/* --------------------------------- session -------------------------------- */

export async function login(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const h = await headers();
  if (!rateLimit(`admin-login:${clientKey(h)}`, 8, 10 * 60_000).ok) return fail('Too many attempts. Wait ten minutes and try again.');
  const pw = form.get('password');
  if (typeof pw !== 'string' || pw.length > 200 || !checkPassword(pw)) return fail('That password is not right.');
  await startSession();
  const next = form.get('next');
  redirect(typeof next === 'string' && /^\/admin(\/[\w\-/?=&%.]*)?$/.test(next) ? next : '/admin');
}

export async function logout() {
  await endSession();
  redirect('/admin/login');
}

/* -------------------------------- products -------------------------------- */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';

function uniqueSlug(base: string) {
  const taken = new Set(getAdminProducts().map((p) => p.slug));
  let slug = base;
  for (let n = 2; taken.has(slug) || isCatalogSlug(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function saveProduct(slug: string, input: ProductInput): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = ProductInputSchema.safeParse(input);
  if (!parsed.success) return fail('Some fields need attention.', fieldErrors(parsed.error));
  const current = getAdminProduct(slug);
  if (!current) return fail('This product no longer exists.');
  const err = await write((d) => patchProduct(d, current, () => parsed.data));
  return err ?? { ok: true };
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ slug: string }>> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = ProductInputSchema.safeParse(input);
  if (!parsed.success) return fail('Some fields need attention.', fieldErrors(parsed.error));
  const slug = uniqueSlug(slugify(`${parsed.data.brand} ${parsed.data.name}`));
  const err = await write((d) => {
    d.created.push({ ...parsed.data, slug, createdAt: new Date().toISOString() });
  });
  return err ?? { ok: true, data: { slug } };
}

export async function duplicateProduct(slug: string): Promise<ActionResult<{ slug: string }>> {
  const p = getAdminProduct(slug);
  if (!p) return fail('This product no longer exists.');
  return createProduct({ ...inputOf(p), name: `${p.name} (copy)`.slice(0, 120), status: 'draft', sku: '' });
}

function removeProducts(d: Overrides, slugs: string[]) {
  for (const slug of slugs) {
    d.created = d.created.filter((c) => c.slug !== slug);
    delete d.products[slug];
    if (isCatalogSlug(slug) && !d.deleted.includes(slug)) d.deleted.push(slug);
  }
}

export async function deleteProduct(slug: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const err = await write((d) => removeProducts(d, [slug]));
  return err ?? { ok: true };
}

const BULK: Record<Exclude<BulkAction, 'delete'>, Partial<ProductInput>> = {
  active: { status: 'active' },
  draft: { status: 'draft' },
  archived: { status: 'archived' },
  'best-on': { bestSeller: true },
  'best-off': { bestSeller: false },
  'new-on': { isNew: true },
  'new-off': { isNew: false },
  'soon-on': { comingSoon: true },
  'soon-off': { comingSoon: false },
};

export async function bulkProducts(slugs: string[], action: BulkAction): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = BulkSchema.safeParse({ slugs, action });
  if (!parsed.success) return fail('Choose some products first.');
  const all = new Map(getAdminProducts().map((p) => [p.slug, p]));
  const { action: act, slugs: list } = parsed.data;
  const err = await write((d) => {
    if (act === 'delete') return removeProducts(d, list);
    for (const slug of list) {
      const p = all.get(slug);
      if (p) patchProduct(d, p, (input) => ({ ...input, ...BULK[act] }));
    }
  });
  return err ?? { ok: true };
}

export async function saveInventory(changes: { slug: string; size: string; qty: number }[]): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = InventorySchema.safeParse({ changes });
  if (!parsed.success) return fail('Quantities must be whole numbers from 0.');
  const all = new Map(getAdminProducts().map((p) => [p.slug, p]));
  const err = await write((d) => {
    for (const c of parsed.data.changes) {
      const p = all.get(c.slug);
      if (p?.sizes.includes(c.size)) patchProduct(d, p, (input) => ({ ...input, stock: { ...input.stock, [c.size]: c.qty } }));
    }
  });
  return err ?? { ok: true };
}

/* --------------------------------- orders --------------------------------- */

export async function updateOrders(ids: string[], patch: { fulfillment?: (typeof FULFILLMENT)[number]; archived?: boolean }): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some((id) => typeof id !== 'string' || !/^[ow]\d{4,7}$/.test(id)))
    return fail('Choose some orders first.');
  if (patch.fulfillment !== undefined && !FULFILLMENT.includes(patch.fulfillment)) return fail('Unknown status.');
  // website orders (w…) live in the orders file and move by their own statuses; only archiving applies here
  const web = ids.filter((id) => id.startsWith('w'));
  const sample = ids.filter((id) => id.startsWith('o'));
  if (web.length && typeof patch.archived === 'boolean') {
    try {
      await patchCodOrders(web, { archived: patch.archived });
    } catch (e) {
      return fail(e instanceof ReadOnlyStoreError ? e.message : 'Could not save.');
    }
    revalidatePath('/admin', 'layout');
  }
  if (!sample.length) return { ok: true };
  const err = await write((d) => {
    for (const id of sample) {
      d.orders[id] = {
        ...d.orders[id],
        ...(patch.fulfillment ? { fulfillment: patch.fulfillment } : {}),
        ...(typeof patch.archived === 'boolean' ? { archived: patch.archived } : {}),
      };
    }
  });
  return err ?? { ok: true };
}

export async function addOrderNote(id: string, text: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const note = typeof text === 'string' ? text.trim() : '';
  if (!note || note.length > 1000) return fail('Write a note of up to 1000 characters.');
  if (!getOrder(id)) return fail('This order no longer exists.');
  if (id.startsWith('w')) {
    try {
      await addCodNote(id, note);
    } catch (e) {
      return fail(e instanceof ReadOnlyStoreError ? e.message : 'Could not save the note.');
    }
    revalidatePath('/admin', 'layout');
    return { ok: true };
  }
  const err = await write((d) => {
    const cur = d.orders[id] ?? {};
    d.orders[id] = { ...cur, notes: [...(cur.notes ?? []), { at: new Date().toISOString(), text: note }].slice(-100) };
  });
  return err ?? { ok: true };
}

/** Move a website order along: confirm it after the call/SMS, ship, deliver, cancel, mark returned. */
export async function setOrderStatus(id: string, status: CodStatus): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (typeof id !== 'string' || !/^w\d{5,7}$/.test(id) || !getCodOrder(id)) return fail('This order no longer exists.');
  if (!COD_STATUS.includes(status)) return fail('Unknown status.');
  try {
    await setCodStatus(id, status);
  } catch (e) {
    if (e instanceof StockError) return fail(`Not enough stock to reopen it: ${e.message}.`);
    if (e instanceof ReadOnlyStoreError) return fail(e.message);
    console.error('[admin] order status failed', e);
    return fail('Could not save. Check the server log.');
  }
  // stock may have moved: refresh the store too
  revalidatePath('/', 'layout');
  return { ok: true };
}

/* -------------------------------- delivery -------------------------------- */

/** Save delivery prices per wilaya (DA; null = not offered). Prices equal to the starting list are not stored. */
export async function saveDelivery(tariffs: Record<string, { home: number | null; desk: number | null }>): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = DeliverySchema.safeParse({ tariffs });
  if (!parsed.success) return fail('Prices must be whole dinars from 0 to 100 000.');
  const keep: Record<string, { home: number | null; desk: number | null }> = {};
  for (const w of WILAYAS) {
    const t = parsed.data.tariffs[String(w.code)];
    if (t && (t.home !== w.home || t.desk !== w.desk)) keep[String(w.code)] = t;
  }
  const err = await write((d) => {
    d.delivery = { tariffs: keep };
  });
  return err ?? { ok: true };
}

/* ---------------------------------- data ---------------------------------- */

export async function importStore(json: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (typeof json !== 'string' || json.length > 2_000_000) return fail('That file is too large.');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return fail('That file is not valid JSON.');
  }
  const parsed = OverridesSchema.safeParse(data);
  if (!parsed.success) return fail('That file is not a SMADI store export.');
  try {
    // an export saved before the switch to dinars is converted on the way in
    await replaceOverrides(toDinars(parsed.data));
  } catch (e) {
    return fail(e instanceof ReadOnlyStoreError ? e.message : 'Could not import.');
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function resetStore(): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  try {
    await replaceOverrides(EMPTY_OVERRIDES);
  } catch (e) {
    return fail(e instanceof ReadOnlyStoreError ? e.message : 'Could not reset.');
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
