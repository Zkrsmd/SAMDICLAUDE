import 'server-only';
import { KIND, PAIRS, rawProducts } from '@/data/products';
import { sports } from '@/data/categories';
import { brandName } from '@/data/brands';
import { colorFamily } from '@/lib/color';
import { loadStore, readOverrides, uploadedMedia } from '@/lib/store/overrides';
import { CatalogSchema, type ListingParams } from '@/lib/validation/catalog';
import { colorsOf, type AdminProduct, type CreatedProduct, type Overrides, type ProductInput } from '@/lib/validation/admin';
import type { Product, SportSlug } from '@/types/catalog';
import { rankSearch, type SearchDoc } from '@/lib/search';
import { fr } from '@/i18n/fr';
import { ar } from '@/i18n/ar';

/** Validated once at module load — a malformed catalogue fails the build, not the customer. */
const base: Product[] = CatalogSchema.parse(rawProducts) as Product[];
const baseSlugs = new Set(base.map((p) => p.slug));

/* --------------------------- admin edits (store) --------------------------- */

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
  // the catalogue's own counts (from Odoo): sized products start at 0 until counted in the admin
  stock: p.stock ?? Object.fromEntries(p.sizes.map((s) => [s, 0])),
  sku: p.sku ?? `SM-${1001 + i}`,
  colorName: p.colors[0]!.name,
  swatch: /^#[0-9a-f]{6}$/i.test(p.colors[0]!.swatch[0] ?? '') ? p.colors[0]!.swatch[0]! : '#8E99A8',
  tags: p.tags,
  bestSeller: !!p.bestSeller,
  isNew: !!p.isNew,
  featured: !!p.featured,
  comingSoon: !!p.comingSoon,
  status: 'active',
  seoTitle: '',
  seoDescription: '',
});

/** the colours as the store shows them: the admin's list, or (none set) one plain "As shown" that isn't offered as a choice */
const colorIds = (list: { name: string }[]) => {
  const seen = new Set<string>();
  return list.map((c) => {
    let id = c.name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'colour';
    for (let n = 2; seen.has(id); n++) id = `${id.replace(/-\d+$/, '')}-${n}`;
    seen.add(id);
    return id;
  });
};
function colorsFor(p: Product, i: ProductInput): Pick<Product, 'colors' | 'colorChoice'> {
  const list = colorsOf(i);
  if (!list.length) return { colors: [{ id: p.colors[0]?.id ?? 'standard', name: 'As shown', swatch: ['#8E99A8'], palette: { primary: '#8E99A8', secondary: '#8E99A8', accent: '#8E99A8' } }], colorChoice: false };
  const ids = colorIds(list);
  return {
    colors: list.map((c, k) => ({ id: ids[k]!, name: c.name, swatch: [c.swatch], palette: { primary: c.swatch, secondary: c.swatch, accent: c.swatch } })),
    colorChoice: true,
  };
}

const applyInput = (p: Product, i: ProductInput): Product => ({
  ...p,
  ...colorsFor(p, i),
  backdrop: i.backdrop || undefined,
  picks: i.picks?.length ? i.picks : undefined,
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
  comingSoon: i.comingSoon,
  specs: p.specs.filter((s) => s.label !== 'Colour'),
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

/**
 * Where a product's photo is: a photo uploaded in the admin (kept in the database, served from
 * /media) wins over the catalogue photo in /products.
 */
export function imageFor(slug: string, slot: 1 | 2 = 1): string | null {
  const v = uploadedMedia().get(`${slug}-${slot}`);
  if (v) return `/media/${slug}-${slot}.webp?v=${v}`;
  return slot === 1 ? `/products/${slug}-1.webp` : null;
}

/** The product's photos as the store shows them (admin uploads first). */
const withPhotos = (p: Product): Product => {
  const two = imageFor(p.slug, 2);
  return { ...p, images: [imageFor(p.slug)!, ...(two ? [two] : [])] };
};

/** Call before using the catalogue in a page, route or action (brings the admin's changes up to date). */
export const ensureStore = loadStore;

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
      sampleStock: false,
      createdAt: '2026-11-17T00:00:00.000Z',
      image: imageFor(p.slug)!,
      image2: imageFor(p.slug, 2),
    });
    if (input.status === 'active') products.push(withPhotos(edit ? applyInput(p, edit) : p));
  });
  for (const c of o.created) {
    if (baseSlugs.has(c.slug)) continue;
    admin.push({ ...c, ...names(c), created: true, edited: true, sampleStock: false, image: imageFor(c.slug)!, image2: imageFor(c.slug, 2) });
    if (c.status === 'active') products.push(withPhotos(fromCreated(c)));
  }
  const liveSports = live(products);
  return { admin, products, liveSports, liveMap: new Map(liveSports.map((s) => [s.slug, s])), bySlug: new Map(products.map((p) => [p.slug, p])) };
}

let memo: { src: Overrides; media: Map<string, number>; state: State } | null = null;
/** Catalogue + the admin's changes, rebuilt only when the store changes. */
function state(): State {
  const src = readOverrides();
  const media = uploadedMedia();
  if (memo?.src !== src || memo.media !== media) memo = { src, media, state: build(src) };
  return memo.state;
}

/** Every product as the admin sees it: drafts and archived included. */
export const getAdminProducts = () => state().admin;
export const getAdminProduct = (slug: string) => state().admin.find((p) => p.slug === slug);
export const isCatalogSlug = (slug: string) => baseSlugs.has(slug);
/** Sold out: stock is tracked and every size is at 0. */
export const soldOut = (p: Pick<Product, 'stock' | 'sizes'>) => !!p.stock && p.sizes.every((s) => (p.stock?.[s] ?? 0) <= 0);
export const sizeAvailable = (p: Pick<Product, 'stock'>, size: string) => !p.stock || (p.stock[size] ?? 0) > 0;

/**
 * What the store says about a product:
 * - "soon": the admin ticked Coming soon (with or without stock) — shown, not sold yet
 * - "out": not coming soon and every size is at 0
 * - "in": on sale
 */
export type Availability = 'in' | 'out' | 'soon';
export const availability = (p: Pick<Product, 'stock' | 'sizes' | 'comingSoon'>): Availability => (p.comingSoon ? 'soon' : soldOut(p) ? 'out' : 'in');

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
  /** "in" on sale, "out" out of stock, "soon" coming soon (not sold yet) */
  availability: Availability;
  /** sizes at 0 when stock is tracked */
  soldOutSizes: string[];
  short: string;
  colors: { id: string; name: string; swatch: string[] }[];
  sizes: string[];
  bestSeller: boolean;
  isNew: boolean;
  verified: boolean;
  kind: Product['model']['kind'];
  /** the photo to show (an admin upload or the catalogue photo) */
  image: string;
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
  availability: availability(p),
  soldOutSizes: p.stock ? p.sizes.filter((s) => (p.stock?.[s] ?? 0) <= 0) : [],
  short: p.short,
  colors: p.colors.map(({ id, name, swatch }) => ({ id, name, swatch })),
  sizes: p.sizes,
  bestSeller: !!p.bestSeller,
  isNew: !!p.isNew,
  verified: p.verified,
  kind: p.model.kind,
  image: imageFor(p.slug)!,
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

/** a name in the three languages, so a search in any of them finds it */
const tri = (en: string) => `${en} ${fr[en] ?? ''} ${ar[en] ?? ''}`;

/** what search reads about a product (src/lib/search.ts) */
function searchDoc(p: Product): SearchDoc {
  const sport = sports.find((s) => s.slug === p.sport);
  const sub = sport?.subs.find((x) => x.slug === p.sub);
  return {
    slug: p.slug,
    name: p.name,
    brand: brandName(p.brand),
    sub: tri(sub?.name ?? p.sub.replace(/-/g, ' ')),
    sport: tri(sport?.name ?? p.sport),
    extra: [...p.tags, ...(p.colorChoice ? p.colors.map((c) => c.name) : [])].join(' '),
    live: availability(p) === 'in',
    best: !!p.bestSeller,
  };
}
const docs = new WeakMap<Product, SearchDoc>();
const docOf = (p: Product) => {
  let d = docs.get(p);
  if (!d) docs.set(p, (d = searchDoc(p)));
  return d;
};

/** `list` filtered to the products matching `q`, best match first */
function searched(list: Product[], q: string): Product[] {
  if (!q.trim()) return list;
  const bySlug = new Map(list.map((p) => [p.slug, p]));
  return rankSearch(list.map(docOf), q).map((d) => bySlug.get(d.slug)!);
}

export function applyListing(list: Product[], f: ListingParams): Product[] {
  const out = searched(list, f.q).filter((p) => {
    if (f.brand.length && !f.brand.includes(p.brand)) return false;
    if (f.color.length && !productFamilies(p).some((c) => f.color.includes(c))) return false;
    if (f.size.length && !p.sizes.some((s) => f.size.includes(s.toLowerCase()))) return false;
    if (f.min !== undefined && p.price < f.min) return false;
    if (f.max !== undefined && p.price > f.max) return false;
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
      // a search keeps its best-match order
      return f.q.trim() ? out : out.sort((a, b) => score(b) - score(a));
  }
}

export const search = (q: string) => applyListing(state().products, { q, brand: [], color: [], size: [], min: undefined, max: undefined, sort: 'featured' });

/* ----------------------------- recommendations ---------------------------- */

const rank = (a: Product, b: Product) =>
  Number(!!b.bestSeller) - Number(!!a.bestSeller) || Number(!!b.featured) - Number(!!a.featured) || a.price - b.price;

/** a stable number per product, so the default picks vary between similar products */
const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * The shop's own picks to show with a product: the ones chosen in the admin, otherwise one
 * well-ranked product from each category it goes with (PAIRS), varied per product.
 */
export function shopPicks(p: Product, limit = 4): Product[] {
  const out: Product[] = [];
  for (const slug of p.picks ?? []) {
    const x = getProduct(slug);
    if (x && x.slug !== p.slug && !out.includes(x)) out.push(x);
  }
  if (out.length) return out.slice(0, limit);
  const seed = seedOf(p.slug);
  for (const key of p.pairsWith ?? []) {
    const [sport, sub] = key.split('/') as [SportSlug, string];
    const options = productsFor(sport, sub)
      .filter((x) => x.slug !== p.slug && availability(x) !== 'out')
      .sort(rank)
      .slice(0, 3);
    const pick = options[seed % Math.max(1, options.length)];
    if (pick && !out.includes(pick)) out.push(pick);
    if (out.length >= limit) break;
  }
  return out;
}

/** COMPLETE YOUR KIT, without order data: the shop's picks. */
export const completeKit = (p: Product, limit = 3) => shopPicks(p, limit);

/** How many orders of a product before what customers buy counts as much as the shop's picks. */
const TRUST_AFTER = 150;
/** a pair must have been bought together this often before it counts at all */
const MIN_TOGETHER = 3;

/**
 * "Complete the look": the shop's picks, moved little by little by what customers really buy with
 * this product. With few orders the picks decide; the order data weighs in as orders grow —
 * half-and-half at 150 orders of the product, mostly the data after several hundred. A pair needs
 * at least 3 orders together to count, so one order never changes anything.
 */
export function boughtWith(p: Product, together: { orders: number; with: Map<string, number> }, limit = 3): Product[] {
  const picks = shopPicks(p, 6);
  const w = together.orders / (together.orders + TRUST_AFTER);
  const score = new Map<string, number>();
  picks.forEach((x, k) => score.set(x.slug, (1 - w) * (1 - k * 0.12)));
  let max = 0;
  for (const n of together.with.values()) if (n >= MIN_TOGETHER) max = Math.max(max, n);
  if (max)
    for (const [slug, n] of together.with) if (n >= MIN_TOGETHER) score.set(slug, (score.get(slug) ?? 0) + w * (n / max));
  return [...score]
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => getProduct(slug))
    .filter((x): x is Product => !!x && x.slug !== p.slug && availability(x) !== 'out')
    .slice(0, limit);
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
    ...docOf(p),
    brandName: brandName(p.brand),
    price: p.price,
    image: imageFor(p.slug)!,
    colorId: p.colors[0]!.id,
  }));
export type SearchIndexEntry = ReturnType<typeof searchIndex>[number];
