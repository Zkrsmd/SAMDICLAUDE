import type { BrandEntry } from '@/types/catalog';
import { STORE_BRANDS } from '@/data/products';

/**
 * Brands carried by the store (manufacturers whose products are listed — not partners).
 * Logos are the official marks from Wikimedia Commons (public/brands/*.svg); trademarks of their owners.
 * Only the brands with a logo appear in the homepage brand strip.
 */
const LOGOS: Record<string, { logo: string; keepColor?: boolean }> = {
  nike: { logo: '/brands/nike.svg' },
  adidas: { logo: '/brands/adidas.svg' },
  puma: { logo: '/brands/puma.svg' },
  everlast: { logo: '/brands/everlast.svg' },
  arena: { logo: '/brands/arena.svg' },
  wilson: { logo: '/brands/wilson.svg', keepColor: true },
};

export const brands: (BrandEntry & { logo?: string; keepColor?: boolean })[] = Object.entries(STORE_BRANDS).map(([id, name]) => ({
  id,
  name,
  style: 'title',
  weight: 800,
  tracking: 0,
  ...LOGOS[id],
}));

export const brandName = (id: string) => STORE_BRANDS[id] ?? id;
