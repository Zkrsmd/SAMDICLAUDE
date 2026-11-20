import type { Metadata } from 'next';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { editorOptions } from '@/components/admin/editor-data';
import { PageHead } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { storeWritable } from '@/lib/store/overrides';

export const metadata: Metadata = { title: 'Add product' };

export default async function NewProductPage() {
  await requireAdmin();
  const { sports, vendors } = editorOptions();
  const sport = sports[0]!;
  return (
    <div className="adm-page adm-page-narrow">
      <PageHead title="Add product" back="/admin/products" />
      <ProductEditor
        initial={{
          name: '',
          brand: vendors[0]?.id ?? 'nike',
          sport: sport.slug as 'football',
          sub: sport.subs[0]!.slug,
          price: 0,
          compareAt: null,
          cost: null,
          short: '',
          description: '',
          sizes: ['One size'],
          stock: { 'One size': 0 },
          sku: '',
          colorName: 'Standard',
          swatch: '#2F3A41',
          tags: [],
          bestSeller: false,
          isNew: true,
          featured: false,
          comingSoon: false,
          status: 'draft',
          seoTitle: '',
          seoDescription: '',
        }}
        meta={{}}
        sports={sports}
        vendors={vendors}
        writable={storeWritable()}
      />
    </div>
  );
}
