export const SPORT_SLUGS = [
  'football',
  'boxing',
  'martial-arts',
  'swimming',
  'diving',
  'pool',
  'fishing',
  'fitness',
  'recovery',
  'running',
  'basketball',
  'volleyball',
  'racket',
  'fan',
  'outdoor',
] as const;
export type SportSlug = (typeof SPORT_SLUGS)[number];

export const MODEL_KINDS = [
  'boot',
  'ball',
  'sock',
  'shinguard',
  'jersey',
  'shorts',
  'cone',
  'bottle',
  'bag',
  'glove',
  'handwrap',
  'mouthguard',
  'headgear',
  'heavybag',
  'rope',
  'mitt',
  'goggles',
  'cap',
  'swimsuit',
  'fins',
  'kickboard',
  'pullbuoy',
  'towel',
  'dumbbell',
  'kettlebell',
  'mat',
  'jacket',
] as const;
export type ModelKind = (typeof MODEL_KINDS)[number];

/** Colours that drive a procedural representative model. */
export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  detail?: string;
}

export interface ProductColor {
  id: string;
  name: string;
  /** CSS colour(s) for the swatch chip. */
  swatch: string[];
  palette: Palette;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export type ModelOptions = Record<string, string | number | boolean>;

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  sport: SportSlug;
  sub: string;
  /** Price in minor units (cents). Demo values unless `verified` says otherwise. */
  price: number;
  /** Was-price shown struck through (set in the admin). */
  compareAt?: number;
  /** Units per size, when the admin tracks stock (a size at 0 is sold out). */
  stock?: Record<string, number>;
  /** Announced but not on sale yet (set in the admin): shown as "Coming soon", whatever the stock. */
  comingSoon?: boolean;
  short: string;
  description: string;
  features: string[];
  specs: ProductSpec[];
  sizes: string[];
  colors: ProductColor[];
  model: { kind: ModelKind; options?: ModelOptions };
  tags: string[];
  bestSeller?: boolean;
  isNew?: boolean;
  featured?: boolean;
  /** true only when model name + colourway were checked against a retailer/manufacturer listing. */
  verified: boolean;
  sourceNote?: string;
  /** Subcategory keys ("sport/sub") this product is commonly paired with. */
  pairsWith?: string[];
  /** Product photos (cut-out WebP, first = hero). */
  images?: string[];
  /** false when there is no real photo yet (the image file is a placeholder) */
  photo?: boolean;
  /** shop reference (Odoo internal reference) */
  sku?: string;
  /** true when the admin set real colours: the product page then shows the colour choice (otherwise nothing) */
  colorChoice?: boolean;
  /** the word behind the photo on the product page (empty: the brand name) */
  backdrop?: string;
  /** products the admin picked to show with this one ("Complete the look"), in order */
  picks?: string[];
}

export interface Subcategory {
  slug: string;
  name: string;
  blurb: string;
  showroom?: 'wall' | 'hooks' | 'plinths';
}

export interface Sport {
  slug: SportSlug;
  name: string;
  tier: 'major' | 'minor';
  tagline: string;
  description: string;
  accent: string;
  accentSoft: string;
  subs: Subcategory[];
}

export interface BrandEntry {
  id: string;
  name: string;
  /** Word-mark styling hints — rendered as typography, never as official logo artwork. */
  style: 'lower' | 'upper' | 'title';
  weight: number;
  tracking: number;
}
