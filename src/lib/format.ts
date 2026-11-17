import { brand } from '@/config/brand';

const fmt = new Intl.NumberFormat(brand.commerce.locale, {
  style: 'currency',
  currency: brand.commerce.currency,
});

export const formatPrice = (cents: number) => fmt.format(cents / 100);

/** Cut-out product photo (scripts/build-catalog.mjs). `hero` = first image, others = second image. */
export type RenderAngle = 'hero' | 'side' | 'top' | 'detail';
export const renderUrl = (slug: string, _colorId?: string, angle: RenderAngle = 'hero') =>
  `/products/${slug}-${angle === 'hero' ? 1 : 2}.webp`;
