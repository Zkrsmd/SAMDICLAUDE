import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductExperience } from '@/components/product/ProductExperience';
import { ProductGrid, RecentlyViewed } from '@/components/product/ProductRail';
import { brandName } from '@/data/brands';
import { completeKit, getAllProducts, getProduct, getSport, getSub, moreFromCollection, toCard } from '@/lib/catalog';

export const dynamicParams = false;
export function generateStaticParams() {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).slug);
  return p ? { title: `${brandName(p.brand)} ${p.name}`, description: p.short } : {};
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const sport = getSport(product.sport)!;
  const sub = getSub(product.sport, product.sub)!;
  // what goes with it (three picks from the categories it pairs with), then more of the same kind
  const kit = completeKit(product, 3);
  const same = moreFromCollection(product, 8);
  const cards = getAllProducts().map(toCard);

  return (
    <>
      <ProductExperience key={product.slug} product={product} brandName={brandName(product.brand)} sportName={sport.name} subName={sub.name} />

      {kit.length > 0 && (
        <section aria-labelledby="kit-title" className="container-x pt-16 md:pt-24">
          <p className="eyebrow text-muted">Buy it with</p>
          <h2 id="kit-title" className="display mt-2 text-[clamp(28px,5.6vw,64px)]">
            Complete <span className="holo-text">the look</span>
          </h2>
          <div className="mt-7">
            <ProductGrid items={kit.map(toCard)} cols={3} />
          </div>
        </section>
      )}

      {same.length > 0 && (
        <section aria-labelledby="same-title" className="container-x pb-6 pt-16 md:pt-24">
          <p className="eyebrow text-muted">{sport.name}</p>
          <h2 id="same-title" className="display mt-2 text-[clamp(28px,5.6vw,64px)]">
            More <span className="holo-text">{sub.name.toLowerCase()}</span>
          </h2>
          <div className="mt-7">
            <ProductGrid items={same.map(toCard)} />
          </div>
        </section>
      )}
      <RecentlyViewed cards={cards} exclude={product.slug} />
    </>
  );
}
