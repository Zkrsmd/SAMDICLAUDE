import 'server-only';
import type { AdminProduct, Overrides, ProductInput } from '@/lib/validation/admin';

/** The editable part of an admin product. */
export const inputOf = (p: AdminProduct): ProductInput => ({
  name: p.name,
  brand: p.brand,
  sport: p.sport,
  sub: p.sub,
  price: p.price,
  compareAt: p.compareAt,
  cost: p.cost,
  short: p.short,
  description: p.description,
  sizes: p.sizes,
  stock: p.stock,
  sku: p.sku,
  colorName: p.colorName,
  swatch: p.swatch,
  tags: p.tags,
  bestSeller: p.bestSeller,
  isNew: p.isNew,
  featured: p.featured,
  comingSoon: p.comingSoon,
  status: p.status,
  seoTitle: p.seoTitle,
  seoDescription: p.seoDescription,
});

/** Apply a change to a product, wherever it is kept (an edit of a catalogue product, or an added one). */
export function patchProduct(d: Overrides, p: AdminProduct, change: (input: ProductInput) => ProductInput) {
  if (p.created) {
    const i = d.created.findIndex((c) => c.slug === p.slug);
    if (i >= 0) d.created[i] = { ...d.created[i]!, ...change(d.created[i]!) };
  } else d.products[p.slug] = change(d.products[p.slug] ?? inputOf(p));
}
