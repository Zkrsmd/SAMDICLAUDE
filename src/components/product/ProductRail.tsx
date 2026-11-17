'use client';
import { ProductCard } from './ProductCard';
import type { CardData } from '@/lib/catalog';
import { useRecent } from '@/stores/lists';
import { useHydrated } from '@/hooks/useHydrated';

export function ProductGrid({ items, cols = 4, priorityFirst }: { items: CardData[]; cols?: 3 | 4; priorityFirst?: boolean }) {
  return (
    <ul className={`grid grid-cols-2 gap-x-3 gap-y-8 ${cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
      {items.map((p, i) => (
        <li key={p.slug}>
          <ProductCard p={p} priority={priorityFirst && i < 2} />
        </li>
      ))}
    </ul>
  );
}

export function ProductRail({ items, label }: { items: CardData[]; label: string }) {
  return (
    <ul aria-label={label} className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {items.map((p) => (
        <li key={p.slug} className="w-[46vw] shrink-0 snap-start md:w-[22%]">
          <ProductCard p={p} size="sm" />
        </li>
      ))}
    </ul>
  );
}

/** Recently viewed products (stored locally on this device). */
export function RecentlyViewed({ cards, exclude, title = 'Recently viewed' }: { cards: CardData[]; exclude?: string; title?: string }) {
  const hydrated = useHydrated();
  const slugs = useRecent((s) => s.slugs);
  if (!hydrated) return null;
  const items = slugs
    .filter((s) => s !== exclude)
    .map((s) => cards.find((c) => c.slug === s))
    .filter((c): c is CardData => !!c)
    .slice(0, 8);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-title" className="container-x py-12">
      <h2 id="recent-title" className="display text-[clamp(32px,8vw,64px)]">
        {title}
      </h2>
      <div className="mt-6">
        <ProductRail items={items} label={title} />
      </div>
    </section>
  );
}
