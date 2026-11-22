import { z } from 'zod';
import { SPORT_SLUGS } from '@/types/catalog';
import { sports } from '@/data/categories';

/**
 * Admin data: what the admin may change about a product, and the store file it is saved in
 * (kept in the D1 database, src/lib/store/overrides.ts). Client-safe: the product editor validates with the same rules
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
/** money in centimes (DA × 100) */
const cents = z.number().int().min(0).max(1_000_000_000);

const ProductFields = z.object({
  name: z.string().trim().min(2, 'Add a title').max(120),
  brand: z.string().trim().min(2, 'Choose a vendor').max(40).regex(/^[a-z0-9-]+$/, 'Vendor id: lowercase letters, numbers, dashes'),
  sport: z.enum(SPORT_SLUGS),
  sub: slugRule,
  price: z.number().int().positive('Price must be above 0').max(1_000_000_000),
  compareAt: cents.nullable(),
  cost: cents.nullable(),
  short: z.string().trim().min(4, 'Add a short line (4+ characters)').max(200),
  description: z.string().trim().min(4, 'Add a description').max(4000),
  sizes: z.array(z.string().trim().min(1).max(32)).min(1, 'Add at least one size').max(40),
  stock: z.record(z.string(), z.number().int().min(0).max(100_000)),
  sku: z.string().trim().max(48),
  /** legacy single colour (kept for older records; `colors` is what the editor uses) */
  colorName: z.string().trim().max(40).default('As shown'),
  swatch: hex.default('#8E99A8'),
  /** the colours a buyer can choose; empty = no colour choice, nothing about colour on the website */
  colors: z.array(z.object({ name: z.string().trim().min(1, 'Name the colour').max(40), swatch: hex })).max(12).optional(),
  /** the big word behind the product photo (empty: the brand name) */
  backdrop: z.string().trim().max(24).optional(),
  /** products to show with this one ("Complete the look"), by slug, in order */
  picks: z.array(z.string().max(96)).max(6).optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(30),
  bestSeller: z.boolean(),
  isNew: z.boolean(),
  featured: z.boolean(),
  /** shown as "Coming soon" and not sold yet, whatever the stock */
  comingSoon: z.boolean().default(false),
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
  if (p.colors && new Set(p.colors.map((c) => c.name.toLowerCase())).size !== p.colors.length) ctx.addIssue({ code: 'custom', path: ['colors'], message: 'Colour names must be unique' });
}

/** The colours a product offers (older records kept one colour in colorName/swatch; "As shown" means none). */
export function colorsOf(i: Pick<ProductInput, 'colors' | 'colorName' | 'swatch'>): { name: string; swatch: string }[] {
  if (i.colors) return i.colors;
  return i.colorName && i.colorName !== 'As shown' ? [{ name: i.colorName, swatch: i.swatch }] : [];
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

/** A wilaya's delivery prices in DA (null: that kind of delivery isn't offered there). */
export const TariffSchema = z.object({
  home: z.number().int().min(0).max(100_000).nullable(),
  desk: z.number().int().min(0).max(100_000).nullable(),
});
export type Tariff = z.infer<typeof TariffSchema>;
export const DeliverySchema = z.object({
  /** by wilaya code ("16"); a missing wilaya uses the built-in starting price */
  tariffs: z.record(z.string().regex(/^\d{1,2}$/), TariffSchema),
});

const httpsOrEmpty = z.union([z.literal(''), z.string().trim().max(200).regex(/^https:\/\/[^\s]+$/, 'Use a full https:// link')]);
/** The shop's links and e-mail in the footer (Admin → Settings). */
export const SiteSchema = z.object({
  email: z.union([z.literal(''), z.string().trim().max(120).email('Enter a valid e-mail')]),
  facebook: httpsOrEmpty,
  instagram: httpsOrEmpty,
  tiktok: httpsOrEmpty,
});
export type SiteSettings = z.infer<typeof SiteSchema>;

/** What the admin keeps about a customer (by phone number): a note and a few tags. */
export const CustomerProfileSchema = z.object({
  note: z.string().trim().max(2000).default(''),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
});
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;

export const OverridesSchema = z.object({
  version: z.literal(1),
  /** prices are in dinars (files saved before the switch held US cents and are converted on read) */
  currency: z.literal('DZD').optional(),
  /** edits to catalogue products, by slug (the full edited record, not a diff) */
  products: z.record(z.string(), ProductInputSchema),
  /** products added in the admin, in the order they were added */
  created: z.array(CreatedProductSchema),
  /** catalogue products removed in the admin */
  deleted: z.array(z.string()),
  orders: z.record(z.string(), OrderPatchSchema),
  /** delivery prices per wilaya, edited in Admin → Delivery */
  delivery: DeliverySchema.optional(),
  /** footer links and e-mail, edited in Admin → Settings */
  site: SiteSchema.optional(),
  /** admin notes and tags per customer (key: the phone number) */
  customers: z.record(z.string().max(40), CustomerProfileSchema).optional(),
  updatedAt: z.string().nullable(),
});
export type Overrides = z.infer<typeof OverridesSchema>;

export const EMPTY_OVERRIDES: Overrides = { version: 1, currency: 'DZD', products: {}, created: [], deleted: [], orders: {}, updatedAt: null };

export const BULK_ACTIONS = ['active', 'draft', 'archived', 'best-on', 'best-off', 'new-on', 'new-off', 'soon-on', 'soon-off', 'delete'] as const;
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
