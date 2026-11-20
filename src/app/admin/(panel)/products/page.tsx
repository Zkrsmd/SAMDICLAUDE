import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductsTable } from '@/components/admin/ProductsTable';
import { AIcon, PageHead } from '@/components/admin/ui';
import { brands } from '@/data/brands';
import { sports } from '@/data/categories';
import { requireAdmin } from '@/lib/admin/auth';
import { getAdminProducts } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage() {
  await requireAdmin();
  const all = getAdminProducts();
  const rows = all.map((p) => ({
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    brandName: p.brandName,
    sport: p.sport,
    sportName: p.sportName,
    sub: p.sub,
    subName: p.subName,
    price: p.price,
    compareAt: p.compareAt,
    status: p.status,
    sizes: p.sizes,
    stock: p.stock,
    image: p.image,
    bestSeller: p.bestSeller,
    isNew: p.isNew,
    comingSoon: p.comingSoon,
    sku: p.sku,
    createdAt: p.createdAt,
    created: p.created,
  }));
  const vendorIds = [...new Set(all.map((p) => p.brand))];
  const vendors = vendorIds.map((id) => ({ id, name: brands.find((b) => b.id === id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="adm-page">
      <PageHead title="Products">
        <Link href="/admin/products/new" className="adm-btn adm-btn-primary">
          <AIcon name="plus" size={16} /> Add product
        </Link>
      </PageHead>
      <ProductsTable rows={rows} vendors={vendors} sports={sports.map((s) => ({ slug: s.slug, name: s.name, subs: s.subs.map((x) => ({ slug: x.slug, name: x.name })) }))} />
    </div>
  );
}
