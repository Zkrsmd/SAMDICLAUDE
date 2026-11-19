import 'server-only';
import { brands } from '@/data/brands';
import { sports } from '@/data/categories';
import { getAdminProducts } from '@/lib/catalog';

/** Choices for the product editor: every sport with its categories, and every vendor in use. */
export function editorOptions() {
  const ids = new Set([...brands.map((b) => b.id), ...getAdminProducts().map((p) => p.brand)]);
  return {
    sports: sports.map((s) => ({ slug: s.slug, name: s.name, subs: s.subs.map((x) => ({ slug: x.slug, name: x.name })) })),
    vendors: [...ids].map((id) => ({ id, name: brands.find((b) => b.id === id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
