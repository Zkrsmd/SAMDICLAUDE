import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductEditor } from '@/components/admin/ProductEditor';
import { editorOptions } from '@/components/admin/editor-data';
import { Badge, PageHead, StatusBadge } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getAdminProduct, getProduct } from '@/lib/catalog';
import { storeWritable } from '@/lib/store/overrides';
import type { ProductInput } from '@/lib/validation/admin';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getAdminProduct((await params).slug);
  return { title: p?.name ?? 'Product' };
}

export default async function EditProductPage({ params }: Props) {
  await requireAdmin();
  const { slug } = await params;
  const p = getAdminProduct(slug);
  if (!p) notFound();
  const initial: ProductInput = {
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
  };
  const { sports, vendors } = editorOptions();
  return (
    <div className="adm-page adm-page-narrow">
      <PageHead
        title={p.name}
        back="/admin/products"
        meta={
          <span className="hidden gap-1.5 sm:flex">
            <StatusBadge status={p.status} />
            {p.created ? <Badge plain>Added in admin</Badge> : null}
          </span>
        }
      />
      <ProductEditor
        key={`${slug}-${p.edited}`}
        initial={initial}
        meta={{ slug, image: p.image, image2: p.image2, sampleStock: p.sampleStock, created: p.created, live: !!getProduct(slug) }}
        sports={sports}
        vendors={vendors}
        writable={storeWritable()}
      />
    </div>
  );
}
