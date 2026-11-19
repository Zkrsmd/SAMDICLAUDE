'use client';
import { useEffect, useRef, useState } from 'react';
import { ProductCard } from './ProductCard';
import type { CardData } from '@/lib/catalog';
import { useRecent } from '@/stores/lists';
import { useHydrated } from '@/hooks/useHydrated';

export function ProductGrid({ items, cols = 4, priorityFirst }: { items: CardData[]; cols?: 3 | 4; priorityFirst?: boolean }) {
  return (
    <ul className={`grid grid-cols-2 gap-2.5 md:gap-3 ${cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
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
      <h2 id="recent-title" className="display text-[clamp(26px,5.4vw,50px)]">
        {title}
      </h2>
      <div className="mt-6">
        <ProductRail items={items} label={title} />
      </div>
    </section>
  );
}

/**
 * The whole range, a page at a time: `step` cards, then more as you reach the end (an observer
 * near the bottom) — and a "Show more" button, so scrolling is never the only way.
 */
export function ProductStream({ items, step = 20 }: { items: CardData[]; step?: number }) {
  const [shown, setShown] = useState(step);
  const end = useRef<HTMLDivElement>(null);
  const more = shown < items.length;
  useEffect(() => {
    const el = end.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setShown((n) => Math.min(items.length, n + step)), { rootMargin: '0px 0px 600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, items.length, step]);
  return (
    <>
      <ProductGrid items={items.slice(0, shown)} />
      <div ref={end} className="mt-8 flex flex-col items-center gap-2">
        <p className="mono text-[12px] text-muted" aria-live="polite">
          Showing {Math.min(shown, items.length)} of {items.length}
        </p>
        {more && (
          <button type="button" className="btn-holo h-12 px-7" onClick={() => setShown((n) => Math.min(items.length, n + step))}>
            Show more
          </button>
        )}
      </div>
    </>
  );
}
