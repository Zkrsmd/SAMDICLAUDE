import Link from 'next/link';
import { HomeHero } from '@/components/home/HomeHero';
import { Brands } from '@/components/home/Brands';
import { CategoryShowcase, type ShowcaseSport } from '@/components/home/CategoryShowcase';
import { Icons } from '@/components/home/Icons';
import { ProductGrid, RecentlyViewed } from '@/components/product/ProductRail';
import { Icon } from '@/components/ui/Icon';
import { brands } from '@/data/brands';
import { bestSellers, countFor, featuredProducts, getAllProducts, getSports, productsFor, toCard } from '@/lib/catalog';

const EXTRA: Partial<Record<ShowcaseSport['slug'], string>> = { football: 'adidas-trionda-pro-ball' };

export default function Home() {
  const sports: ShowcaseSport[] = getSports().map((s) => {
    const list = productsFor(s.slug);
    const hero = list.find((p) => p.featured) ?? list.find((p) => p.bestSeller) ?? list[0]!;
    const extraSlug = EXTRA[s.slug];
    const extra = extraSlug ? list.find((p) => p.slug === extraSlug) : undefined;
    return {
      slug: s.slug,
      name: s.name,
      tagline: s.tagline,
      accent: s.accent,
      count: countFor(s.slug),
      hero: { slug: hero.slug, color: hero.colors[0]!.id },
      extra: extra ? { slug: extra.slug, color: extra.colors[0]!.id } : undefined,
    };
  });
  const icons = featuredProducts()
    .filter((p) => p.verified && p.model.kind !== 'cap')
    .map(toCard);
  const best = bestSellers(undefined, undefined, 8).map(toCard);
  const cards = getAllProducts().map(toCard);

  return (
    <>
      <HomeHero />
      <Brands brands={brands.filter((b) => b.id !== 'your-brand')} />
      <CategoryShowcase sports={sports} />
      <Icons items={icons} />
      <section aria-labelledby="best-title" className="container-x py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted">Most wanted</p>
            <h2 id="best-title" className="display mt-3 text-[clamp(44px,11vw,120px)]">
              Best sellers
            </h2>
          </div>
          <Link href="/search" className="eyebrow inline-flex shrink-0 items-center gap-2 pb-3 hover:text-orange">
            Shop all <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <div className="mt-10">
          <ProductGrid items={best} />
        </div>
      </section>
      <RecentlyViewed cards={cards} />
    </>
  );
}
