import type { ModelKind, Product, SportSlug } from '@/types/catalog';
import generated from './generated.json';

/**
 * Demo catalogue built from official brand listings (scripts/build-catalog.mjs).
 * Images and names belong to the brands — replace with your own products before going public.
 */
interface Row {
  slug: string;
  name: string;
  brand: string;
  sport: SportSlug;
  sub: string;
  price: number;
  images: string[];
  sizes: string[];
  colorName: string;
  swatch: string;
  source: string;
}

const KIND: Record<string, ModelKind> = {
  boots: 'boot', shoes: 'boot', balls: 'ball', gloves: 'glove', 'hand-wraps': 'handwrap', mouthguards: 'mouthguard',
  'head-protection': 'headgear', 'punching-bags': 'heavybag', goggles: 'goggles', caps: 'cap', swimsuits: 'swimsuit',
  'swim-shorts': 'shorts', fins: 'fins', kickboards: 'kickboard', apparel: 'shorts', weights: 'kettlebell',
};

const PAIRS: Record<string, string[]> = {
  'football/boots': ['football/balls', 'football/shorts'],
  'football/balls': ['football/boots'],
  'boxing/gloves': ['boxing/hand-wraps', 'boxing/mouthguards', 'boxing/training'],
  'boxing/hand-wraps': ['boxing/gloves'],
  'boxing/punching-bags': ['boxing/gloves', 'boxing/hand-wraps'],
  'swimming/goggles': ['swimming/caps', 'swimming/swim-shorts', 'swimming/fins'],
  'swimming/caps': ['swimming/goggles'],
  'swimming/fins': ['swimming/kickboards', 'swimming/goggles'],
  'running/shoes': ['running/shoes'],
  'basketball/balls': ['basketball/shoes'],
  'basketball/shoes': ['basketball/balls'],
};

const COPY: Record<string, (r: Row) => string> = {
  boots: () => 'Built for speed, touch and control on match day.',
  shoes: () => 'Engineered cushioning and a locked-in fit for every session.',
  balls: () => 'Match-ready construction for true flight and touch.',
  gloves: () => 'Padded protection and a secure wrist for bag work and sparring.',
  'hand-wraps': () => 'The first layer of protection under every glove.',
  goggles: () => 'Low-profile racing fit with a clear, wide view.',
  caps: () => 'Smooth silicone that keeps you streamlined.',
};

/** Hero / flagship products and best sellers (by slug). */
export const FEATURED = [
  'adidas-f50-hyperfast-elite-fg-soccer-cleats',
  'venum-giant-20-mike-tyson-pro-boxing-gloves-blackgold',
  'speedo-fastskin-speed-socket-20-mirrored-goggles-orangegold',
];
const BEST = new Set([
  ...FEATURED,
  'nike-mercurial-vapor-17-elite-vini-jr-fg',
  'puma-ultra-6-carbon-v126-fg-soccer-cleats',
  'everlast-powerlock-og-pro-training-glove-lace-up',
  'venum-reverso-boxing-gloves-blackgold',
  'nike-control-soccer-ball',
  'speedo-fastskin-cap-pink',
  'nike-vomero-plus-road-running-shoes',
  'lebron-xxiv-stars-basketball-shoes',
  'wilson-evolution-game-basketball',
]);

/** Drop a leading brand word from the retailer title (the brand is shown separately). */
const displayName = (title: string, brand: string) => {
  const t = title.toLowerCase().startsWith(`${brand.toLowerCase()} `) ? title.slice(brand.length + 1).trim() : title;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const BRAND_LABEL: Record<string, string> = {
  nike: 'Nike', adidas: 'adidas', puma: 'PUMA', venum: 'Venum', everlast: 'Everlast', speedo: 'Speedo', arena: 'arena', wilson: 'Wilson',
};

export const rawProducts: (Product & { images: string[] })[] = (generated as Row[]).map((r) => {
  const short = (COPY[r.sub] ?? (() => `${BRAND_LABEL[r.brand] ?? r.brand} ${r.sub.replace(/-/g, ' ')}.`))(r);
  return {
    id: r.slug,
    slug: r.slug,
    name: displayName(r.name, r.brand),
    brand: r.brand,
    sport: r.sport,
    sub: r.sub,
    price: r.price,
    short,
    description: `${BRAND_LABEL[r.brand] ?? r.brand} ${displayName(r.name, r.brand)}. ${short} Demo listing using the brand's official product image and list price (USD) — replace with your own product data.`,
    features: [],
    specs: [
      { label: 'Colour', value: r.colorName },
      { label: 'List price source', value: r.source },
    ],
    sizes: r.sizes,
    colors: [
      {
        id: 'standard',
        name: r.colorName,
        swatch: [r.swatch],
        palette: { primary: r.swatch, secondary: r.swatch, accent: r.swatch },
      },
    ],
    model: { kind: KIND[r.sub] ?? 'bag' },
    tags: [r.brand, r.sport, r.sub.replace(/-/g, ' '), r.colorName.toLowerCase()],
    featured: FEATURED.includes(r.slug),
    bestSeller: BEST.has(r.slug),
    verified: true,
    sourceNote: `Name, image and list price from the official ${r.source} listing (collected 2026-11-17). Demo use only.`,
    pairsWith: PAIRS[`${r.sport}/${r.sub}`],
    images: r.images,
  };
});
