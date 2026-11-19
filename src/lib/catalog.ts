import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { KIND, PAIRS, rawProducts } from '@/data/products';
import { sports } from '@/data/categories';
import { brandName } from '@/data/brands';
import { colorFamily } from '@/lib/color';
import { readOverrides } from '@/lib/store/overrides';
import { CatalogSchema, type ListingParams } from '@/lib/validation/catalog';
import type { AdminProduct, CreatedProduct, Overrides, ProductInput } from '@/lib/validation/admin';
import type { Product, SportSlug } from '@/types/catalog';

/** Validated once at module load — a malformed catalogue fails the build, not the customer. */
const base: Product[] = CatalogSchema.parse(rawProducts) as Product[];
const baseSlugs = new Set(base.map((p) => p.slug));

/* --------------------------- admin edits (store) --------------------------- */

/** small stable hash → sample stock that is the same on every render */
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const sampleStock = (p: { slug: string; sizes: string[] }) =>
  Object.fromEntries(
    p.sizes.map((size) => {
      const h = hash(`${p.slug}|${size}`);
      // mostly healthy shelves, a few running low
      return [size, h % 9 === 0 ? 1 + (h % 4) : 6 + (h % 38)];
    }),
  );

const inputFrom = (p: Product, i: number): ProductInput => ({
  name: p.name,
  brand: p.brand,
  sport: p.sport,
  sub: p.sub,
  price: p.price,
  compareAt: null,
  cost: null,
  short: p.short,
  description: p.description,
  sizes: p.sizes,
  stock: sampleStock(p),
  sku: `SM-${1001 + i}`,
  colorName: p.colors[0]!.name,
  swatch: /^#[0-9a-f]{6}$/i.test(p.colors[0]!.swatch[0] ?? '') ? p.colors[0]!.swatch[0]! : '#8E99A8',
  tags: p.tags,
  bestSeller: !!p.bestSeller,
  isNew: !!p.isNew,
  featured: !!p.featured,
  status: 'active',
  seoTitle: '',
  seoDescription: '',
});

const applyInput = (p: Product, i: ProductInput): Product => ({
  ...p,
  name: i.name,
  brand: i.brand,
  sport: i.sport,
  sub: i.sub,
  price: i.price,
  compareAt: i.compareAt ?? undefined,
  stock: i.stock,
  short: i.short,
  description: i.description,
  sizes: i.sizes,
  tags: i.tags,
  bestSeller: i.bestSeller,
  isNew: i.isNew,
  featured: i.featured,
  colors: [{ id: p.colors[0]!.id, name: i.colorName, swatch: [i.swatch], palette: { primary: i.swatch, secondary: i.swatch, accent: i.swatch } }],
  specs: p.specs.map((s) => (s.label === 'Colour' ? { ...s, value: i.colorName } : s)),
  model: p.sub === i.sub ? p.model : { kind: KIND[i.sub] ?? 'bag' },
  pairsWith: PAIRS[`${i.sport}/${i.sub}`],
});

const fromCreated = (c: CreatedProduct): Product =>
  applyInput(
    {
      id: c.slug,
      slug: c.slug,
      name: c.name,
      brand: c.brand,
      sport: c.sport,
      sub: c.sub,
      price: c.price,
      short: c.short,
      description: c.description,
      features: [],
      specs: [{ label: 'Colour', value: c.colorName }],
      sizes: c.sizes,
      colors: [{ id: 'standard', name: c.colorName, swatch: [c.swatch], palette: { primary: c.swatch, secondary: c.swatch, accent: c.swatch } }],
      model: { kind: KIND[c.sub] ?? 'bag' },
      tags: c.tags,
      verified: false,
      images: [`/products/${c.slug}-1.webp`],
    },
    c,
  );

const second = new Map<string, string | null>();
const secondImage = (slug: string) => {
  if (!second.has(slug)) {
    let found: string | null = null;
    try {
      if (fs.existsSync(path.join(process.cwd(), 'public', 'products', `${slug}-2.webp`))) found = `/products/${slug}-2.webp`;
    } catch {
      found = null;
    }
    second.set(slug, found);
  }
  return second.get(slug)!;
};

interface State {
  admin: AdminProduct[];
  products: Product[];
  liveSports: ReturnType<typeof live>;
  liveMap: Map<SportSlug, ReturnType<typeof live>[number]>;
  bySlug: Map<string, Product>;
}

/** Sports and sub-categories that actually have products. */
const live = (products: Product[]) =>
  sports
    .map((s) => ({ ...s, subs: s.subs.filter((x) => products.some((p) => p.sport === s.slug && p.sub === x.slug)) }))
    .filter((s) => s.subs.length > 0);

function build(o: Overrides): State {
  const deleted = new Set(o.deleted);
  const admin: AdminProduct[] = [];
  const products: Product[] = [];
  const names = (i: ProductInput) => {
    const s = sports.find((x) => x.slug === i.sport);
    return { sportName: s?.name ?? i.sport, subName: s?.subs.find((x) => x.slug === i.sub)?.name ?? i.sub, brandName: brandName(i.brand) };
  };
  base.forEach((p, n) => {
    if (deleted.has(p.slug)) return;
    const edit = o.products[p.slug];
    const input = edit ?? inputFrom(p, n);
    admin.push({
      ...input,
      ...names(input),
      slug: p.slug,
      created: false,
      edited: !!edit,
      sampleStock: !edit,
      createdAt: '2026-11-17T00:00:00.000Z',
      image: `/products/${p.slug}-1.webp`,
      image2: secondImage(p.slug),
    });
    if (input.status === 'active') products.push(edit ? applyInput(p, edit) : p);
  });
  for (const c of o.created) {
    if (baseSlugs.has(c.slug)) continue;
    admin.push({ ...c, ...names(c), created: true, edited: true, sampleStock: false, image: `/products/${c.slug}-1.webp`, image2: secondImage(c.slug) });
    if (c.status === 'active') products.push(fromCreated(c));
  }
  const liveSports = live(products);
  return { admin, products, liveSports, liveMap: new Map(liveSports.map((s) => [s.slug, s])), bySlug: new Map(products.map((p) => [p.slug, p])) };
}

let memo: { src: Overrides; state: State } | null = null;
/** Catalogue + the admin's changes, rebuilt only when the store file changes. */
function state(): State {
  const src = readOverrides();
  if (memo?.src !== src) memo = { src, state: build(src) };
  return memo.state;
}

/** Every product as the admin sees it: drafts and archived included. */
export const getAdminProducts = () => state().admin;
export const getAdminProduct = (slug: string) => state().admin.find((p) => p.slug === slug);
export const isCatalogSlug = (slug: string) => baseSlugs.has(slug);
/** Sold out: stock is tracked and every size is at 0. */
export const soldOut = (p: Pick<Product, 'stock' | 'sizes'>) => !!p.stock && p.sizes.every((s) => (p.stock?.[s] ?? 0) <= 0);
export const sizeAvailable = (p: Pick<Product, 'stock'>, size: string) => !p.stock || (p.stock[size] ?? 0) > 0;

export interface CardData {
  slug: string;
  name: string;
  brand: string;
  brandName: string;
  sport: SportSlug;
  sub: string;
  price: number;
  compareAt: number | null;
  soldOut: boolean;
  /** sizes at 0 when stock is tracked */
  soldOutSizes: string[];
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
  compareAt: p.compareAt ?? null,
  soldOut: soldOut(p),
  soldOutSizes: p.stock ? p.sizes.filter((s) => (p.stock?.[s] ?? 0) <= 0) : [],
  short: p.short,
  colors: p.colors.map(({ id, name, swatch }) => ({ id, name, swatch })),
  sizes: p.sizes,
  bestSeller: !!p.bestSeller,
  isNew: !!p.isNew,
  verified: p.verified,
  kind: p.model.kind,
});

export const getAllProducts = () => state().products;
export const getProduct = (slug: string) => state().bySlug.get(slug);
export const getSport = (slug: string) => state().liveMap.get(slug as SportSlug);
export const getSports = () => state().liveSports;
export const getSub = (sport: string, sub: string) => getSport(sport)?.subs.find((s) => s.slug === sub);

export const productsFor = (sport: SportSlug, sub?: string) =>
  state().products.filter((p) => p.sport === sport && (!sub || p.sub === sub));

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

export const search = (q: string) => applyListing(state().products, { q, brand: [], color: [], size: [], min: undefined, max: undefined, sort: 'featured' });

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
  state().products
    .filter((p) => p.bestSeller && (!sport || p.sport === sport) && p.slug !== exclude)
    .sort(rank)
    .slice(0, limit);

export const moreFromCollection = (p: Product, limit = 8) =>
  state().products.filter((x) => x.sport === p.sport && x.sub === p.sub && x.slug !== p.slug).slice(0, limit);

export function youMayAlsoLike(p: Product, limit = 4): Product[] {
  const kit = new Set(completeKit(p).map((x) => x.slug));
  return state().products
    .filter((x) => x.slug !== p.slug && !kit.has(x.slug) && x.sub !== p.sub && (x.sport === p.sport || x.brand === p.brand))
    .sort(rank)
    .slice(0, limit);
}

export const featuredProducts = () => state().products.filter((p) => p.featured);

/** Lightweight index for the client-side instant search overlay. */
export const searchIndex = () =>
  state().products.map((p) => ({
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
