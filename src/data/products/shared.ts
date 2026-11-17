import type { Palette, Product, ProductColor } from '@/types/catalog';

export const BOOT_SIZES = ['UK 6', 'UK 6.5', 'UK 7', 'UK 7.5', 'UK 8', 'UK 8.5', 'UK 9', 'UK 9.5', 'UK 10', 'UK 10.5', 'UK 11'];
export const SHOE_SIZES = ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12'];
export const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const ONE_SIZE = ['One size'];
export const GLOVE_SIZES = ['10 oz', '12 oz', '14 oz', '16 oz'];

export const color = (id: string, name: string, palette: Palette, swatch?: string[]): ProductColor => ({
  id,
  name,
  palette,
  swatch: swatch ?? [palette.primary, palette.secondary, palette.accent],
});

type Draft = Omit<Product, 'id' | 'tags' | 'features' | 'specs' | 'verified'> &
  Partial<Pick<Product, 'tags' | 'features' | 'specs' | 'verified'>>;

/** Fills defaults; id = slug. Demo items default to verified=false. */
export const product = (d: Draft): Product => ({
  id: d.slug,
  tags: [],
  features: [],
  specs: [],
  verified: false,
  ...d,
});

export const euros = (n: number) => Math.round(n * 100);
