import { z } from 'zod';
import { SPORT_SLUGS } from '@/types/catalog';
import { sports } from '@/data/categories';

/**
 * Admin data: what the admin may change about a product, and the store file it is saved in
 * (src/data/store/overrides.json). Client-safe: the product editor validates with the same rules
 * the server enforces.
 */

export const PRODUCT_STATUS = ['active', 'draft', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export const FULFILLMENT = ['unfulfilled', 'fulfilled'] as const;
export type Fulfillment = (typeof FULFILLMENT)[number];

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a colour like #2F3A41');
export const slugRule = z
  .string()
  .min(2)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes only');
const cents = z.number().int().min(0).max(10_000_000);

const ProductFields = z.object({
  name: z.string().trim().min(2, 'Add a title').max(120),
  brand: z.string().trim().min(2, 'Choose a vendor').max(40).regex(/^[a-z0-9-]+$/, 'Vendor id: lowercase letters, numbers, dashes'),
  sport: z.enum(SPORT_SLUGS),
  sub: slugRule,
  price: z.number().int().positive('Price must be above 0').max(10_000_000),
  compareAt: cents.nullable(),
  cost: cents.nullable(),
  short: z.string().trim().min(4, 'Add a short line (4+ characters)').max(200),
  description: z.string().trim().min(4, 'Add a description').max(4000),
  sizes: z.array(z.string().trim().min(1).max(32)).min(1, 'Add at least one size').max(40),
  stock: z.record(z.string(), z.number().int().min(0).max(100_000)),
  sku: z.string().trim().max(48),
  colorName: z.string().trim().min(1, 'Name the colour').max(40),
  swatch: hex,
  tags: z.array(z.string().trim().min(1).max(32)).max(30),
  bestSeller: z.boolean(),
  isNew: z.boolean(),
  featured: z.boolean(),
  status: z.enum(PRODUCT_STATUS),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(320),
});

function checkProduct(p: z.infer<typeof ProductFields>, ctx: z.RefinementCtx) {
  const sport = sports.find((s) => s.slug === p.sport);
  if (!sport?.subs.some((s) => s.slug === p.sub)) ctx.addIssue({ code: 'custom', path: ['sub'], message: 'Pick a category of this sport' });
  if (p.compareAt !== null && p.compareAt <= p.price)
    ctx.addIssue({ code: 'custom', path: ['compareAt'], message: 'Compare-at price must be higher than the price' });
  if (new Set(p.sizes.map((s) => s.toLowerCase())).size !== p.sizes.length) ctx.addIssue({ code: 'custom', path: ['sizes'], message: 'Sizes must be unique' });
}

export const ProductInputSchema = ProductFields.superRefine(checkProduct);
export type ProductInput = z.infer<typeof ProductFields>;

export const CreatedProductSchema = ProductFields.extend({ slug: slugRule, createdAt: z.string() }).superRefine(checkProduct);
export type CreatedProduct = z.infer<typeof CreatedProductSchema>;

export const OrderPatchSchema = z.object({
  fulfillment: z.enum(FULFILLMENT).optional(),
  archived: z.boolean().optional(),
  notes: z.array(z.object({ at: z.string(), text: z.string().trim().min(1).max(1000) })).max(100).optional(),
});
export type OrderPatch = z.infer<typeof OrderPatchSchema>;

export const OverridesSchema = z.object({
  version: z.literal(1),
  /** edits to catalogue products, by slug (the full edited record, not a diff) */
  products: z.record(z.string(), ProductInputSchema),
  /** products added in the admin, in the order they were added */
  created: z.array(CreatedProductSchema),
  /** catalogue products removed in the admin */
  deleted: z.array(z.string()),
  orders: z.record(z.string(), OrderPatchSchema),
  updatedAt: z.string().nullable(),
});
export type Overrides = z.infer<typeof OverridesSchema>;

export const EMPTY_OVERRIDES: Overrides = { version: 1, products: {}, created: [], deleted: [], orders: {}, updatedAt: null };

export const BULK_ACTIONS = ['active', 'draft', 'archived', 'best-on', 'best-off', 'new-on', 'new-off', 'delete'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const BulkSchema = z.object({ slugs: z.array(slugRule).min(1).max(500), action: z.enum(BULK_ACTIONS) });

export const InventorySchema = z.object({
  changes: z
    .array(z.object({ slug: slugRule, size: z.string().min(1).max(32), qty: z.number().int().min(0).max(100_000) }))
    .min(1)
    .max(2000),
});

/** The fields shown and edited for one product in the admin. */
export interface AdminProduct extends ProductInput {
  slug: string;
  /** true for products added in the admin (false: from the original catalogue) */
  created: boolean;
  /** true when the admin has saved this product at least once */
  edited: boolean;
  /** stock numbers are sample values until someone sets them */
  sampleStock: boolean;
  createdAt: string;
  image: string;
  image2: string | null;
  sportName: string;
  subName: string;
  brandName: string;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string; fields?: Record<string, string> };

/** Zod issues → `{ path: message }` for showing next to the fields. */
export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join('.') || 'form';
    out[k] ??= i.message;
  }
  return out;
}
