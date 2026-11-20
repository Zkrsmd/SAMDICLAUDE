'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ProductGrid } from '@/components/product/ProductRail';
import { ProductImage } from '@/components/product/ProductImage';
import { Icon } from '@/components/ui/Icon';
import { smoothScroll } from '@/lib/smooth-scroll';
import type { CardData } from '@/lib/catalog';

export interface SportShopItem {
  slug: string;
  name: string;
  tagline: string;
  /** product slug whose cut-out stands for the sport in its circle */
  icon?: string;
  subs: { slug: string; name: string; count: number }[];
  /** every product of the sport, best first */
  cards: CardData[];
  best: string[];
  fresh: string[];
}

const FIRST = 8;

/**
 * Shop by sport: a small circle per sport. A tile opens that sport right here on the homepage — its best
 * sellers, what's new and everything it has (filter by category, "See all" grows the grid in
 * place). The open sport is kept in the address (?sport=…) so it can be shared and survives reload.
 */
export function SportShop({ items }: { items: SportShopItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const tiles = useRef<HTMLUListElement>(null);
  const current = items.find((s) => s.slug === open) ?? null;

  // a shared link (?sport=boxing) opens that sport
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('sport');
    if (!want || !items.some((s) => s.slug === want)) return;
    const id = requestAnimationFrame(() => setOpen(want));
    return () => cancelAnimationFrame(id);
  }, [items]);

  const scrollTo = (el: HTMLElement | null, offset: number) => {
    if (!el) return;
    const lenis = smoothScroll.get();
    if (lenis) lenis.scrollTo(el, { offset, duration: 1.1 });
    else {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  const choose = (slug: string) => {
    const next = open === slug ? null : slug;
    setOpen(next);
    setSub(null);
    setAll(false);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('sport', next);
    else url.searchParams.delete('sport');
    window.history.replaceState(window.history.state, '', url);
    // bring the circles + the opened sport up under the header (after it has rendered), so the picked
    // circle stays in view and another sport is one tap away
    if (next) requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(tiles.current, -96)));
  };

  const close = () => {
    if (open) choose(open);
    requestAnimationFrame(() => scrollTo(tiles.current, -110));
  };

  const pick = (slugs: string[]) => slugs.map((s) => current?.cards.find((c) => c.slug === s)).filter((c): c is CardData => !!c);
  const list = current ? current.cards.filter((c) => !sub || c.sub === sub) : [];
  const shown = all ? list : list.slice(0, FIRST);

  return (
    <>
      <ul ref={tiles} className="sport-tiles" data-has-open={open ? '' : undefined}>
        {items.map((s, i) => (
          <li key={s.slug} style={{ ['--i' as string]: i }}>
            <button
              type="button"
              className="sport-tile"
              aria-label={`${s.name}, ${s.cards.length} products`}
              aria-expanded={open === s.slug}
              aria-controls="sport-panel"
              data-open={open === s.slug ? '' : undefined}
              onClick={() => choose(s.slug)}
            >
              <span className="sport-tile-orb" aria-hidden>
                {s.icon && (
                  <span className="sport-tile-obj">
                    <ProductImage slug={s.icon} colorId="standard" alt="" sizes="120px" />
                  </span>
                )}
              </span>
              <span className="sport-tile-name" aria-hidden>
                {s.name}
              </span>
              <span className="sport-tile-count mono" aria-hidden>
                {s.cards.length} products
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div ref={panel} id="sport-panel" role="region" aria-label={current ? `${current.name} shop` : 'Sport shop'} hidden={!current}>
        {current && (
          <div key={current.slug} className="sport-panel">
            <div className="flex items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="eyebrow text-muted">{current.tagline}</p>
                <h3 className="display mt-2 text-[clamp(30px,6vw,64px)]">{current.name}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/${current.slug}`} className="eyebrow hidden items-center gap-2 px-2 py-2 hover:text-cobalt sm:inline-flex">
                  Sport page <Icon name="arrow-right" size={14} />
                </Link>
                <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-full bg-stone transition-colors hover:bg-ink hover:text-white" aria-label={`Close ${current.name}`}>
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            {current.best.length > 0 && (
              <section aria-labelledby="sp-best" className="mt-8">
                <h4 id="sp-best" className="sport-panel-h px-1">
                  Best sellers <span className="text-muted">· {current.name}</span>
                </h4>
                <div className="mt-4">
                  <ProductGrid items={pick(current.best)} />
                </div>
              </section>
            )}

            {current.fresh.length > 0 && (
              <section aria-labelledby="sp-new" className="mt-10">
                <h4 id="sp-new" className="sport-panel-h px-1">
                  New releases <span className="text-muted">· {current.name}</span>
                </h4>
                <div className="mt-4">
                  <ProductGrid items={pick(current.fresh)} />
                </div>
              </section>
            )}

            <section aria-labelledby="sp-all" className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3 px-1">
                <h4 id="sp-all" className="sport-panel-h">
                  All {current.name.toLowerCase()} <span className="text-muted">· {list.length}</span>
                </h4>
              </div>
              {current.subs.length > 1 && (
                <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={`${current.name} categories`}>
                  {[{ slug: null, name: 'All', count: current.cards.length }, ...current.subs].map((x) => (
                    <button
                      key={x.slug ?? 'all'}
                      type="button"
                      className="chip h-10 shrink-0 px-4 text-[13px]"
                      data-active={sub === x.slug}
                      aria-pressed={sub === x.slug}
                      onClick={() => {
                        setSub(x.slug);
                        setAll(false);
                      }}
                    >
                      {x.name} <span className="mono text-[11px] opacity-60">{x.count}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-5">
                <ProductGrid key={sub ?? 'all'} items={shown} />
              </div>
              <div className="mt-7 flex flex-col items-center gap-3">
                {list.length > FIRST && (
                  <button type="button" className="btn-holo h-12 px-7" aria-expanded={all} onClick={() => setAll((a) => !a)}>
                    {all ? 'Show less' : `See all ${list.length}`}
                  </button>
                )}
                <Link href={`/${current.slug}`} className="eyebrow inline-flex items-center gap-2 py-2 text-muted hover:text-cobalt">
                  Open the {current.name.toLowerCase()} page <Icon name="arrow-right" size={14} />
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
