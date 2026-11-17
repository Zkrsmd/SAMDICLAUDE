import type { BrandEntry } from '@/types/catalog';

/**
 * Brands carried by the store. Rendered as typographic word-marks (not official logo
 * artwork). These are manufacturers whose products are listed — NOT commercial partners.
 * Replace with authorised logo files once supplied through each brand's retailer programme.
 */
export const brands: BrandEntry[] = [
  { id: 'adidas', name: 'adidas', style: 'lower', weight: 800, tracking: -0.02 },
  { id: 'nike', name: 'Nike', style: 'upper', weight: 900, tracking: 0.02 },
  { id: 'puma', name: 'Puma', style: 'upper', weight: 800, tracking: 0.08 },
  { id: 'venum', name: 'Venum', style: 'upper', weight: 900, tracking: 0.12 },
  { id: 'speedo', name: 'Speedo', style: 'lower', weight: 800, tracking: -0.01 },
  { id: 'arena', name: 'arena', style: 'lower', weight: 700, tracking: 0.04 },
  { id: 'the-north-face', name: 'The North Face', style: 'title', weight: 700, tracking: -0.01 },
  { id: 'everlast', name: 'Everlast', style: 'upper', weight: 800, tracking: 0.06 },
  { id: 'wilson', name: 'Wilson', style: 'title', weight: 800, tracking: 0 },
  { id: 'your-brand', name: 'YOUR BRAND Essentials', style: 'upper', weight: 700, tracking: 0.06 },
];

export const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
