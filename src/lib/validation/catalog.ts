import { z } from 'zod';
import { MODEL_KINDS, SPORT_SLUGS } from '@/types/catalog';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected #RRGGBB');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'expected kebab-case slug');

export const PaletteSchema = z.object({
  primary: hex,
  secondary: hex,
  accent: hex,
  detail: hex.optional(),
});

export const ProductSchema = z.object({
  id: slug,
  slug,
  name: z.string().min(2).max(120),
  brand: z.string().min(2),
  sport: z.enum(SPORT_SLUGS),
  sub: slug,
  price: z.number().int().positive(),
  short: z.string().min(4),
  description: z.string().min(4),
  features: z.array(z.string()),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  sizes: z.array(z.string()).min(1),
  colors: z
    .array(z.object({ id: slug, name: z.string(), swatch: z.array(z.string()).min(1), palette: PaletteSchema }))
    .min(1),
  model: z.object({
    kind: z.enum(MODEL_KINDS),
    options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  }),
  tags: z.array(z.string()),
  bestSeller: z.boolean().optional(),
  isNew: z.boolean().optional(),
  featured: z.boolean().optional(),
  verified: z.boolean(),
  sourceNote: z.string().optional(),
  pairsWith: z.array(z.string().regex(/^[a-z]+\/[a-z0-9-]+$/)).optional(),
  images: z.array(z.string().regex(/^\/products\/[a-z0-9-]+\.webp$/)).optional(),
});

export const CatalogSchema = z.array(ProductSchema).superRefine((items, ctx) => {
  const seen = new Set<string>();
  for (const [i, p] of items.entries()) {
    if (seen.has(p.slug)) ctx.addIssue({ code: 'custom', message: `duplicate slug ${p.slug}`, path: [i, 'slug'] });
    seen.add(p.slug);
  }
});

/** Cart quote request — the client sends ids and quantities only, never prices. */
export const CartQuoteRequestSchema = z.object({
  items: z
    .array(
      z.object({
        productId: slug.max(96),
        colorId: slug.max(48),
        size: z.string().min(1).max(32),
        qty: z.number().int().min(1).max(20),
      }),
    )
    .max(50),
});
export type CartQuoteRequest = z.infer<typeof CartQuoteRequestSchema>;

export const SORT_OPTIONS = ['featured', 'price-asc', 'price-desc', 'name'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : (v ?? '').split(','))
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[a-z0-9 .-]{1,40}$/.test(s)),
  );

const money = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    const raw = Array.isArray(v) ? v[0] : v;
    const n = raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 && n < 100000 ? Math.round(n * 100) : undefined;
  });

/** Listing filters parsed from URL search params (untrusted input). */
export const ListingParamsSchema = z.object({
  brand: csv,
  color: csv,
  size: csv,
  min: money,
  max: money,
  sort: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => {
      const s = Array.isArray(v) ? v[0] : v;
      return (SORT_OPTIONS as readonly string[]).includes(s ?? '') ? (s as SortOption) : 'featured';
    }),
  q: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => ((Array.isArray(v) ? v[0] : v) ?? '').slice(0, 80).trim()),
});
export type ListingParams = z.infer<typeof ListingParamsSchema>;
