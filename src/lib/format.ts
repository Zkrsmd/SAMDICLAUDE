import { brand } from '@/config/brand';

const fmt = new Intl.NumberFormat(brand.commerce.locale, {
  style: 'currency',
  currency: brand.commerce.currency,
});

export const formatPrice = (cents: number) => fmt.format(cents / 100);

/**
 * A product name short enough for a card: the part before any " - " / "(" / "," detail (colourway,
 * pack size), then whole words up to `max` characters. "Fastskin Speed Socket 2.0 Mirrored Goggles -
 * Orange/Gold" → "Fastskin Speed Socket 2.0".
 */
export function shortName(name: string, max = 24) {
  const base = name.split(/\s[-–—|/]\s|\s\(|,/)[0]!.trim();
  if (base.length <= max) return base;
  let out = '';
  for (const w of base.split(/\s+/)) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || base.slice(0, max);
}

/** Cut-out product photo (scripts/build-catalog.mjs). `hero` = first image, others = second image. */
export type RenderAngle = 'hero' | 'side' | 'top' | 'detail';
export const renderUrl = (slug: string, _colorId?: string, angle: RenderAngle = 'hero') =>
  `/products/${slug}-${angle === 'hero' ? 1 : 2}.webp`;
