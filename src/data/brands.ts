import type { BrandEntry } from '@/types/catalog';

/**
 * Brands carried by the store (manufacturers whose products are listed — not partners).
 * Logos are the official marks from Wikimedia Commons (public/brands/*.svg); trademarks of their owners.
 */
export const brands: (BrandEntry & { logo?: string })[] = [
  { id: 'nike', name: 'Nike', style: 'upper', weight: 900, tracking: 0, logo: '/brands/nike.svg' },
  { id: 'adidas', name: 'adidas', style: 'lower', weight: 800, tracking: 0, logo: '/brands/adidas.svg' },
  { id: 'puma', name: 'PUMA', style: 'upper', weight: 800, tracking: 0, logo: '/brands/puma.svg' },
  { id: 'venum', name: 'VENUM', style: 'upper', weight: 900, tracking: 0.12 },
  { id: 'everlast', name: 'Everlast', style: 'upper', weight: 800, tracking: 0, logo: '/brands/everlast.svg' },
  { id: 'speedo', name: 'Speedo', style: 'lower', weight: 800, tracking: 0, logo: '/brands/speedo.svg' },
  { id: 'arena', name: 'arena', style: 'lower', weight: 700, tracking: 0, logo: '/brands/arena.svg' },
  { id: 'wilson', name: 'Wilson', style: 'title', weight: 800, tracking: 0, logo: '/brands/wilson.svg' },
];

export const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
