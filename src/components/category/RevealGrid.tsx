'use client';
import { useEffect, useRef } from 'react';
import { ProductCard } from '@/components/product/ProductCard';
import type { CardData } from '@/lib/catalog';
import { useT } from '@/i18n/client';

/**
 * Product listing with the "explode" reveal: on the first visit to a listing in this session,
 * cards burst out from the tapped tile (or screen centre) and settle into the grid (≤700 ms).
 * The grid is interactive immediately; reduced motion disables the effect.
 */
export function RevealGrid({ items, revealKey }: { items: CardData[]; revealKey: string }) {
  const t = useT();
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const key = `yb-revealed:${revealKey}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      return;
    }
    let origin = { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
    try {
      const raw = sessionStorage.getItem('yb-burst');
      const b = raw ? (JSON.parse(raw) as { x: number; y: number; t: number }) : null;
      if (b && Date.now() - b.t < 8000) origin = { x: b.x, y: b.y };
    } catch {
      /* ignore */
    }
    const cards = [...el.children] as HTMLElement[];
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      if (r.top > window.innerHeight * 1.4) return;
      const dx = origin.x - (r.left + r.width / 2);
      const dy = origin.y - (r.top + r.height / 2);
      const rot = (Math.random() - 0.5) * 40;
      c.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(0.35) rotate(${rot}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.25 },
          { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
        ],
        { duration: 680, delay: i * 45, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' },
      );
    });
  }, [revealKey]);

  if (!items.length)
    return (
      <div className="py-20 text-center">
        <p className="display text-[44px] text-ink/20">{t('No matches')}</p>
        <p className="mt-2 text-muted">{t('Try removing a filter.')}</p>
      </div>
    );
  return (
    <ul ref={ref} className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <li key={p.slug} className={i === 0 && items.length > 4 ? 'col-span-2 md:col-span-1' : ''}>
          <ProductCard p={p} size={i === 0 && items.length > 4 ? 'lg' : 'md'} priority={i < 2} />
        </li>
      ))}
    </ul>
  );
}
