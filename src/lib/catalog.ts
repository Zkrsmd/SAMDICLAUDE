import 'server-only';
import { rawProducts } from '@/data/products';
import { sports } from '@/data/categories';
import { brandName } from '@/data/brands';
import { colorFamily } from '@/lib/color';
import { CatalogSchema, type ListingParams } from '@/lib/validation/catalog';
import type { Product, SportSlug } from '@/types/catalog';

/** Validated once at module load — a malformed catalogue fails the build, not the customer. */
const products: Product[] = CatalogSchema.parse(rawProducts) as Product[];

/** Sports and sub-categories that actually have products. */
const liveSports = sports
  .map((s) => ({ ...s, subs: s.subs.filter((x) => products.some((p) => p.sport === s.slug && p.sub === x.slug)) }))
  .filter((s) => s.subs.length > 0);
const liveMap = new Map(liveSports.map((s) => [s.slug, s]));
const bySlug = new Map(products.map((p) => [p.slug, p]));

export interface CardData {
  slug: string;
  name: string;
  brand: string;
  brandName: string;
  sport: SportSlug;
  sub: string;
  price: number;
  short: string;
  colors: { id: string; name: string; swatch: string[] }[];
  sizes: string[];
  bestSeller: boolean;
  isNew: boolean;
  verified: boolean;
  kind: Product['model']['kind'];
}

export const toCard = (p: Product): CardData => ({
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  brandName: brandName(p.brand),
  sport: p.sport,
  sub: p.sub,
  price: p.price,
  short: p.short,
  colors: p.colors.map(({ id, name, swatch }) => ({ id, name, swatch })),
  sizes: p.sizes,
  bestSeller: !!p.bestSeller,
  isNew: !!p.isNew,
  verified: p.verified,
  kind: p.model.kind,
});

export const getAllProducts = () => products;
export const getProduct = (slug: string) => bySlug.get(slug);
export const getSport = (slug: string) => liveMap.get(slug as SportSlug);
export const getSports = () => liveSports;
export const getSub = (sport: string, sub: string) => getSport(sport)?.subs.find((s) => s.slug === sub);

export const productsFor = (sport: SportSlug, sub?: string) =>
  products.filter((p) => p.sport === sport && (!sub || p.sub === sub));

export const countFor = (sport: SportSlug, sub?: string) => productsFor(sport, sub).length;

export interface FacetSet {
  brands: { id: string; name: string; count: number }[];
  colors: { id: string; count: number }[];
  sizes: { id: string; count: number }[];
  priceRange: [number, number];
}

const productFamilies = (p: Product) => [...new Set(p.colors.map((c) => colorFamily(c.palette.primary)))];

export function facetsFor(list: Product[]): FacetSet {
  const brandCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  const sizeCounts = new Map<string, number>();
  let lo = Infinity;
  let hi = 0;
  for (const p of list) {
    brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
    for (const f of productFamilies(p)) colorCounts.set(f, (colorCounts.get(f) ?? 0) + 1);
    for (const s of p.sizes) sizeCounts.set(s, (sizeCounts.get(s) ?? 0) + 1);
    lo = Math.min(lo, p.price);
    hi = Math.max(hi, p.price);
  }
  return {
    brands: [...brandCounts].map(([id, count]) => ({ id, name: brandName(id), count })),
    colors: [...colorCounts].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
    sizes: [...sizeCounts].map(([id, count]) => ({ id, count })),
    priceRange: list.length ? [lo, hi] : [0, 0],
  };
}

const matchesQuery = (p: Product, q: string) => {
  if (!q) return true;
  const hay = [p.name, brandName(p.brand), p.sport, p.sub.replace(/-/g, ' '), p.short, ...p.tags, ...p.colors.map((c) => c.name)]
    .join(' ')
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
};

export function applyListing(list: Product[], f: ListingParams): Product[] {
  const out = list.filter((p) => {
    if (f.brand.length && !f.brand.includes(p.brand)) return false;
    if (f.color.length && !productFamilies(p).some((c) => f.color.includes(c))) return false;
    if (f.size.length && !p.sizes.some((s) => f.size.includes(s.toLowerCase()))) return false;
    if (f.min !== undefined && p.price < f.min) return false;
    if (f.max !== undefined && p.price > f.max) return false;
    if (!matchesQuery(p, f.q)) return false;
    return true;
  });
  const score = (p: Product) => (p.featured ? 4 : 0) + (p.bestSeller ? 2 : 0) + (p.verified ? 1 : 0);
  switch (f.sort) {
    case 'price-asc':
      return out.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return out.sort((a, b) => b.price - a.price);
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return out.sort((a, b) => score(b) - score(a));
  }
}

export const search = (q: string) => applyListing(products, { q, brand: [], color: [], size: [], min: undefined, max: undefined, sort: 'featured' });

/* ----------------------------- recommendations ---------------------------- */

const rank = (a: Product, b: Product) =>
  Number(!!b.bestSeller) - Number(!!a.bestSeller) || Number(!!b.featured) - Number(!!a.featured) || a.price - b.price;

/** COMPLETE YOUR KIT — one best item from each paired subcategory. */
export function completeKit(p: Product, limit = 3): Product[] {
  const out: Product[] = [];
  for (const key of p.pairsWith ?? []) {
    const [sport, sub] = key.split('/') as [SportSlug, string];
    const pick = productsFor(sport, sub)
      .filter((x) => x.slug !== p.slug)
      .sort(rank)[0];
    if (pick && !out.includes(pick)) out.push(pick);
    if (out.length >= limit) break;
  }
  return out;
}

export const bestSellers = (sport?: SportSlug, exclude?: string, limit = 6) =>
  products
    .filter((p) => p.bestSeller && (!sport || p.sport === sport) && p.slug !== exclude)
    .sort(rank)
    .slice(0, limit);

export const moreFromCollection = (p: Product, limit = 8) =>
  products.filter((x) => x.sport === p.sport && x.sub === p.sub && x.slug !== p.slug).slice(0, limit);

export function youMayAlsoLike(p: Product, limit = 4): Product[] {
  const kit = new Set(completeKit(p).map((x) => x.slug));
  return products
    .filter((x) => x.slug !== p.slug && !kit.has(x.slug) && x.sub !== p.sub && (x.sport === p.sport || x.brand === p.brand))
    .sort(rank)
    .slice(0, limit);
}

export const featuredProducts = () => products.filter((p) => p.featured);

/** Lightweight index for the client-side instant search overlay. */
export const searchIndex = () =>
  products.map((p) => ({
    slug: p.slug,
    name: p.name,
    brandName: brandName(p.brand),
    sport: p.sport,
    sub: p.sub,
    price: p.price,
    colorId: p.colors[0]!.id,
    terms: [p.name, brandName(p.brand), p.sport, p.sub.replace(/-/g, ' '), ...p.tags].join(' ').toLowerCase(),
  }));
export type SearchIndexEntry = ReturnType<typeof searchIndex>[number];
