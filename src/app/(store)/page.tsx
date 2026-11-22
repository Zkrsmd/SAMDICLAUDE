import Link from 'next/link';
import { Hero } from '@/components/hero/Hero';
import { Brands } from '@/components/home/Brands';
import { SportShop, type SportShopItem } from '@/components/home/SportShop';
import { ProductGrid, ProductStream, RecentlyViewed } from '@/components/product/ProductRail';
import { Icon } from '@/components/ui/Icon';
import { SplitWords } from '@/components/ui/SplitWords';
import { brands } from '@/data/brands';
import { sportIcons } from '@/config/hero';
import { applyListing, bestSellers, getAllProducts, getSports, productsFor, toCard, type CardData } from '@/lib/catalog';
import { ensureStore } from '@/lib/catalog';
import { getT } from '@/i18n/server';
import type { Metadata } from 'next';
import { brand } from '@/config/brand';
import { JsonLd } from '@/components/seo/JsonLd';
import { storeLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { alternates: { canonical: '/' } };

/** deterministic shuffle (the page is prerendered: same order on server and client) */
function shuffle<T>(list: T[], seed: number) {
  const a = [...list];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function Heading({ id, eyebrow, title, accent, action }: { id: string; eyebrow: string; title: string; accent?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-muted">{eyebrow}</p>
        <h2 id={id} className="display mt-2 text-[clamp(30px,6.2vw,78px)]" data-reveal="words">
          <SplitWords text={title} />
          {accent ? (
            <>
              {' '}
              <SplitWords text={accent} className="holo-text" from={title.split(' ').length} />
            </>
          ) : null}
        </h2>
      </div>
      {action}
    </div>
  );
}

export default async function Home() {
  await ensureStore();
  const t = await getT();
  const all = getAllProducts();
  const sports = getSports();
  // every sport as a small circle that opens in place: its best sellers, what's new, everything
  const shop: SportShopItem[] = sports.map((s) => {
    const list = applyListing(productsFor(s.slug), { q: '', brand: [], color: [], size: [], min: undefined, max: undefined, sort: 'featured' });
    const best = bestSellers(s.slug, undefined, 4).map((p) => p.slug);
    // fewer than four best sellers: top it up with the next best of the sport
    for (const p of list) if (best.length < 4 && !best.includes(p.slug)) best.push(p.slug);
    const fresh = [...productsFor(s.slug)]
      .reverse()
      .filter((p) => !best.includes(p.slug))
      .slice(0, 4)
      .map((p) => p.slug);
    return {
      slug: s.slug,
      name: t(s.name),
      tagline: t(s.tagline),
      icon: sportIcons[s.slug] ?? productsFor(s.slug)[0]?.slug,
      subs: s.subs.map((x) => ({ slug: x.slug, name: t(x.name), count: productsFor(s.slug, x.slug).length })),
      // only what the panel shows first; the full list is fetched when the sport is opened
      cards: list
        .filter((p) => best.includes(p.slug) || fresh.includes(p.slug))
        .map((p) => (fresh.includes(p.slug) ? { ...toCard(p), isNew: true } : toCard(p))),
      total: list.length,
      best,
      fresh,
    };
  });

  const best = bestSellers(undefined, undefined, 8);
  const taken = new Set(best.map((p) => p.slug));
  // newest first (the catalogue lists products in the order they were added), taken from each
  // sport in turn so the row is a mix, not twelve of the last thing added
  const queues = sports.map((s) => [...all].reverse().filter((p) => p.sport === s.slug && !taken.has(p.slug)));
  const newest: CardData[] = [];
  for (let r = 0; newest.length < 12 && queues.some((q) => q.length > r); r++)
    for (const q of queues) if (q[r] && newest.length < 12) newest.push({ ...toCard(q[r]!), isNew: true });
  newest.forEach((p) => taken.add(p.slug));
  // a mixed sample of the rest (the full range is one tap away in each sport and in search)
  const rest = shuffle(
    all.filter((p) => !taken.has(p.slug)),
    20261118,
  )
    .slice(0, 60)
    .map(toCard);

  return (
    <>
      <JsonLd data={storeLd(t(brand.description))} />
      <Hero />
      {/* the store slides up over the films as one sheet */}
      <div className="home-sheet">

      <section aria-labelledby="cats-title" className="container-x pt-14 md:pt-20">
        <Heading id="cats-title" eyebrow={t('Shop by sport')} title={t('Pick your')} accent={t('sport')} />
        <div className="mt-7">
          <SportShop items={shop} />
        </div>
      </section>

      <section aria-labelledby="best-title" className="container-x pt-16 md:pt-24">
        <Heading
          id="best-title"
          eyebrow={t('Most wanted')}
          title={t('Best')}
          accent={t('sellers')}
          action={
            <Link href="/search" className="eyebrow inline-flex shrink-0 items-center gap-2 pb-2 hover:text-cobalt">
              {t('Shop all')} <Icon name="arrow-right" size={14} />
            </Link>
          }
        />
        <div className="mt-7">
          <ProductGrid items={best.map(toCard)} priorityFirst />
        </div>
      </section>

      <section aria-labelledby="new-title" className="container-x pt-16 md:pt-24">
        <Heading id="new-title" eyebrow={t('Just dropped')} title={t('New')} accent={t('in')} />
        <div className="mt-7">
          <ProductGrid items={newest} />
        </div>
      </section>

      <section aria-labelledby="all-title" className="container-x pb-10 pt-16 md:pt-24">
        <Heading id="all-title" eyebrow={t('{n} products', { n: all.length })} title={t('Everything')} accent={t('else')} />
        <div className="mt-7">
          <ProductStream items={rest} />
        </div>
      </section>

      <RecentlyViewed />
      {/* the brands close the page (customers reach the sports and products first) */}
      <Brands brands={brands.filter((b) => b.logo)} />
      </div>
    </>
  );
}
