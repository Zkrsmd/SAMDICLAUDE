import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductExperience } from '@/components/product/ProductExperience';
import { ProductGrid, ProductRail, RecentlyViewed } from '@/components/product/ProductRail';
import { Bundle } from '@/components/product/Bundle';
import { FloatingCollection } from '@/components/product/FloatingCollection';
import { Icon } from '@/components/ui/Icon';
import { brandName } from '@/data/brands';
import {
  bestSellers,
  completeKit,
  getAllProducts,
  getProduct,
  getSport,
  getSub,
  moreFromCollection,
  toCard,
  youMayAlsoLike,
} from '@/lib/catalog';

export const dynamicParams = false;
export function generateStaticParams() {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProduct((await params).slug);
  return p ? { title: `${brandName(p.brand)} ${p.name}`, description: p.short } : {};
}

const OTHER_WORLDS: Record<string, { slug: string; cls: string; ink: string }[]> = {
  football: [
    { slug: 'boxing', cls: 'world-gym', ink: '#171A18' },
    { slug: 'swimming', cls: 'world-water', ink: '#FFFFFF' },
  ],
  boxing: [
    { slug: 'football', cls: 'world-turf', ink: '#FFFFFF' },
    { slug: 'swimming', cls: 'world-water', ink: '#FFFFFF' },
  ],
  swimming: [
    { slug: 'football', cls: 'world-turf', ink: '#FFFFFF' },
    { slug: 'boxing', cls: 'world-gym', ink: '#171A18' },
  ],
};

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const sport = getSport(product.sport)!;
  const sub = getSub(product.sport, product.sub)!;
  const kit = completeKit(product);
  const bundle = [product, ...kit.slice(0, 2)].map((p) => ({
    slug: p.slug,
    name: p.name,
    brandName: brandName(p.brand),
    price: p.price,
    colorId: p.colors[0]!.id,
    sizes: p.sizes,
  }));
  const collection = moreFromCollection(product);
  const best = bestSellers(product.sport, product.slug, 4);
  const also = youMayAlsoLike(product);
  const cards = getAllProducts().map(toCard);
  const worlds = OTHER_WORLDS[product.sport] ?? OTHER_WORLDS.football!;

  return (
    <>
      <Suspense>
        <ProductExperience product={product} brandName={brandName(product.brand)} sportName={sport.name} subName={sub.name} />
      </Suspense>

      {kit.length > 0 && (
        <section aria-labelledby="kit-title" className="container-x py-14">
          <p className="eyebrow text-muted">Complete your kit</p>
          <h2 id="kit-title" className="display mt-3 text-[clamp(40px,10vw,96px)]">
            Goes with it
          </h2>
          <div className="mt-8">
            <ProductGrid items={kit.map(toCard)} cols={3} />
          </div>
        </section>
      )}

      {bundle.length > 1 && (
        <section aria-labelledby="bundle-title" className="container-x py-10">
          <p className="eyebrow text-muted">Often bought together</p>
          <h2 id="bundle-title" className="display mt-3 text-[clamp(32px,8vw,64px)]">
            The set
          </h2>
          <div className="mt-6">
            <Bundle items={bundle} />
          </div>
        </section>
      )}

      {best.length > 0 && (
        <section aria-labelledby="bs-title" className="container-x py-14">
          <p className="eyebrow text-muted">{sport.name}</p>
          <h2 id="bs-title" className="display mt-3 text-[clamp(32px,8vw,64px)]">
            Best sellers
          </h2>
          <div className="mt-6">
            <ProductRail items={best.map(toCard)} label="Best sellers" />
          </div>
        </section>
      )}

      {/* other worlds */}
      <section aria-label="Explore other sports" className="container-x grid gap-3 py-10 md:grid-cols-2">
        {worlds.map((w) => {
          const s = getSport(w.slug)!;
          return (
            <Link key={w.slug} href={`/${w.slug}`} className={`world ${w.cls} group relative flex min-h-[38vw] items-end overflow-hidden rounded-[2px] p-5 md:min-h-[260px]`}>
              <span aria-hidden className="world-fx absolute inset-0" />
              <span className="relative">
                <span className="eyebrow block" style={{ color: w.ink }}>
                  Another world
                </span>
                <span className="display mt-1 flex items-center gap-3 text-[clamp(44px,12vw,96px)]" style={{ color: w.ink }}>
                  {s.name} <Icon name="arrow-right" size={36} className="transition-transform group-hover:translate-x-2" />
                </span>
              </span>
            </Link>
          );
        })}
      </section>

      {collection.length > 0 && <FloatingCollection items={collection.map(toCard)} title={`More ${sub.name.toLowerCase()}`} />}

      {also.length > 0 && (
        <section aria-labelledby="also-title" className="container-x py-14">
          <h2 id="also-title" className="display text-[clamp(32px,8vw,64px)]">
            You may also like
          </h2>
          <div className="mt-6">
            <ProductGrid items={also.map(toCard)} />
          </div>
        </section>
      )}
      <RecentlyViewed cards={cards} exclude={product.slug} />
    </>
  );
}
