'use client';
import { useEffect, useRef, useState } from 'react';
import { ProductCard } from './ProductCard';
import type { CardData } from '@/lib/catalog';
import { useRecent } from '@/stores/lists';
import { useCards } from '@/hooks/useCards';
import { useHydrated } from '@/hooks/useHydrated';
import { useT } from '@/i18n/client';

export function ProductGrid({ items, cols = 4, priorityFirst }: { items: CardData[]; cols?: 3 | 4; priorityFirst?: boolean }) {
  return (
    <ul className={`grid grid-cols-2 gap-2.5 md:gap-3 ${cols === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
      {items.map((p, i) => (
        // each card rises in as it scrolls into view, staggered across its row
        <li key={p.slug} data-reveal="card" style={{ '--i': i % 4 } as React.CSSProperties}>
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
export function RecentlyViewed({ exclude, title }: { exclude?: string; title?: string }) {
  const t = useT();
  title = title ?? t('Recently viewed');
  const hydrated = useHydrated();
  const slugs = useRecent((s) => s.slugs);
  const cards = useCards(hydrated ? slugs.filter((s) => s !== exclude).slice(0, 8) : []);
  if (!hydrated || !cards) return null;
  const items = cards.slice(0, 8);
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
  const t = useT();
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
          {t('Showing {a} of {b}', { a: Math.min(shown, items.length), b: items.length })}
        </p>
        {more && (
          <button type="button" className="btn-holo h-12 px-7" onClick={() => setShown((n) => Math.min(items.length, n + step))}>
            {t('Show more')}
          </button>
        )}
      </div>
    </>
  );
}
