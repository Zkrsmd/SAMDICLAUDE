import type { Metadata } from 'next';
import { InventoryTable } from '@/components/admin/InventoryTable';
import { PageHead, SampleNote } from '@/components/admin/ui';
import { sports } from '@/data/categories';
import { requireAdmin } from '@/lib/admin/auth';
import { getAdminProducts } from '@/lib/catalog';
import { storeWritable } from '@/lib/store/overrides';

export const metadata: Metadata = { title: 'Inventory' };

export default async function InventoryPage() {
  await requireAdmin();
  const products = getAdminProducts().filter((p) => p.status !== 'archived');
  const rows = products.flatMap((p) => p.sizes.map((size) => ({ slug: p.slug, name: p.name, image: p.image, sku: p.sku, size, qty: p.stock[size] ?? 0, sport: p.sport, sample: p.sampleStock })));
  const sampled = products.filter((p) => p.sampleStock).length;
  return (
    <div className="adm-page">
      <PageHead title="Inventory" />
      {sampled > 0 && (
        <SampleNote>
          {sampled} of {products.length} products still show sample stock numbers. Set a quantity (here or on the product) to start tracking it — a size at 0
          shows as sold out in the store and can’t be bought.
        </SampleNote>
      )}
      <InventoryTable rows={rows} sports={sports.map((s) => ({ slug: s.slug, name: s.name }))} writable={storeWritable()} />
    </div>
  );
}
