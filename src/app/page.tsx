import Link from 'next/link';
import { Hero } from '@/components/hero/Hero';
import { Brands } from '@/components/home/Brands';
import { CategoryBubbles, type Bubble } from '@/components/home/CategoryBubbles';
import { ProductGrid, ProductStream, RecentlyViewed } from '@/components/product/ProductRail';
import { Icon } from '@/components/ui/Icon';
import { SplitWords } from '@/components/ui/SplitWords';
import { brands } from '@/data/brands';
import { bestSellers, getAllProducts, getSports, productsFor, toCard, type CardData } from '@/lib/catalog';

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

export default function Home() {
  const all = getAllProducts();
  const sports = getSports();
  // every category inside every sport, as small bubbles
  const categoryBubbles: Bubble[] = sports.flatMap((s) =>
    s.subs.map((sub) => {
      const list = productsFor(s.slug, sub.slug);
      return { href: `/${s.slug}/${sub.slug}`, name: sub.name, count: list.length, thumb: (list.find((p) => p.bestSeller) ?? list[0]!).slug };
    }),
  );

  const best = bestSellers(undefined, undefined, 8);
  const taken = new Set(best.map((p) => p.slug));
  // newest first (the catalogue lists products in the order they were added), taken from each
  // sport in turn so the row is a mix, not twelve of the last thing added
  const queues = sports.map((s) => [...all].reverse().filter((p) => p.sport === s.slug && !taken.has(p.slug)));
  const newest: CardData[] = [];
  for (let r = 0; newest.length < 12 && queues.some((q) => q.length > r); r++)
    for (const q of queues) if (q[r] && newest.length < 12) newest.push({ ...toCard(q[r]!), isNew: true });
  newest.forEach((p) => taken.add(p.slug));
  const rest = shuffle(
    all.filter((p) => !taken.has(p.slug)),
    20261118,
  ).map(toCard);
  const cards = all.map(toCard);

  return (
    <>
      <Hero />
      {/* the store slides up over the films as one sheet */}
      <div className="home-sheet">
      <Brands brands={brands} />

      <section aria-labelledby="cats-title" className="container-x pt-14 md:pt-20">
        <Heading id="cats-title" eyebrow="Shop by category" title="Find your" accent="game" />
        <div className="mt-7">
          <CategoryBubbles items={categoryBubbles} label="Categories" />
        </div>
      </section>

      <section aria-labelledby="best-title" className="container-x pt-16 md:pt-24">
        <Heading
          id="best-title"
          eyebrow="Most wanted"
          title="Best"
          accent="sellers"
          action={
            <Link href="/search" className="eyebrow inline-flex shrink-0 items-center gap-2 pb-2 hover:text-cobalt">
              Shop all <Icon name="arrow-right" size={14} />
            </Link>
          }
        />
        <div className="mt-7">
          <ProductGrid items={best.map(toCard)} priorityFirst />
        </div>
      </section>

      <section aria-labelledby="new-title" className="container-x pt-16 md:pt-24">
        <Heading id="new-title" eyebrow="Just dropped" title="New" accent="in" />
        <div className="mt-7">
          <ProductGrid items={newest} />
        </div>
      </section>

      <section aria-labelledby="all-title" className="container-x pb-10 pt-16 md:pt-24">
        <Heading id="all-title" eyebrow={`${all.length} products`} title="Everything" accent="else" />
        <div className="mt-7">
          <ProductStream items={rest} />
        </div>
      </section>

      <RecentlyViewed cards={cards} />
      </div>
    </>
  );
}
