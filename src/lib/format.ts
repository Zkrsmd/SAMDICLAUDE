import { brand } from '@/config/brand';

const fmt = new Intl.NumberFormat(brand.commerce.locale, {
  style: 'currency',
  currency: brand.commerce.currency,
});

export const formatPrice = (cents: number) => fmt.format(cents / 100);

/** Representative studio render produced by `npm run renders`. */
export type RenderAngle = 'hero' | 'side' | 'top' | 'detail';
export const renderUrl = (slug: string, colorId: string, angle: RenderAngle = 'hero') =>
  `/renders/${slug}--${colorId}--${angle}.webp`;
