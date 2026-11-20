import { brand } from '@/config/brand';

/**
 * "12 500 DA". Built by hand (not Intl) so the server and every browser print exactly the same
 * characters — a different ICU build must not cause a hydration mismatch.
 */
/** no-break space: "12 500 DA" never wraps */
const NBSP = String.fromCharCode(160);
export const formatPrice = (centimes: number) => {
  const da = Math.round(centimes / 100);
  const digits = String(Math.abs(da)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${da < 0 ? '-' : ''}${digits}${NBSP}DA`;
};

/** A demo US list price (cents) → dinars (centimes), rounded to 100 DA. */
export const usdToDzd = (usdCents: number) => Math.max(1, Math.round(((usdCents / 100) * brand.commerce.demoUsdRate) / 100)) * 100 * 100;

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
