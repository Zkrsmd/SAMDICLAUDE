'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ProductGrid } from '@/components/product/ProductRail';
import { ProductImage } from '@/components/product/ProductImage';
import { Icon } from '@/components/ui/Icon';
import { smoothScroll } from '@/lib/smooth-scroll';
import type { CardData } from '@/lib/catalog';
import { useT } from '@/i18n/client';

export interface SportShopItem {
  slug: string;
  name: string;
  tagline: string;
  /** product slug whose cut-out stands for the sport in its circle */
  icon?: string;
  subs: { slug: string; name: string; count: number }[];
  /** the best sellers and new cards (the rest of the sport loads when it is opened) */
  cards: CardData[];
  /** how many products the sport has */
  total: number;
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
  const t = useT();
  const openRef = useRef(open);
  openRef.current = open;

  // phones: the one-line row drifts slowly sideways on its own (turning round at each end) until
  // the visitor touches it, scrolls it, focuses it or opens a sport; it picks up again a few seconds
  // later. Off screen it rests; reduced motion turns it off. State in refs — no re-renders.
  useEffect(() => {
    const el = tiles.current;
    if (!el) return;
    const phone = window.matchMedia('(max-width: 767px)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let visible = true;
    let pausedUntil = performance.now() + 1500;
    let dir = 1;
    let pos = el.scrollLeft;
    let last = performance.now();
    const SPEED = 22; // px per second
    const pause = (ms = 3500) => {
      pausedUntil = performance.now() + ms;
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last);
      last = now;
      if (!phone.matches || calm.matches || !visible || openRef.current || now < pausedUntil) {
        pos = el.scrollLeft;
        return;
      }
      const before = el.scrollLeft;
      pos += dir * SPEED * (dt / 1000);
      el.scrollLeft = pos;
      // stuck at an end (works the same left to right and right to left): turn round after a breath
      if (Math.abs(el.scrollLeft - before) < 0.01 && Math.abs(pos - before) > 1) {
        dir = -dir;
        pos = el.scrollLeft;
        pause(1200);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
    });
    io.observe(el);
    const touch = () => pause();
    const opts = { passive: true } as const;
    el.addEventListener('pointerdown', touch, opts);
    el.addEventListener('touchstart', touch, opts);
    el.addEventListener('wheel', touch, opts);
    el.addEventListener('focusin', touch);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener('pointerdown', touch);
      el.removeEventListener('touchstart', touch);
      el.removeEventListener('wheel', touch);
      el.removeEventListener('focusin', touch);
    };
  }, []);
  // every card of the opened sport, fetched once when it opens
  const [full, setFull] = useState<Record<string, CardData[]>>({});
  useEffect(() => {
    if (!open || full[open]) return;
    let live = true;
    fetch(`/api/cards?sport=${open}`)
      .then((r) => (r.ok ? (r.json() as Promise<CardData[]>) : null))
      .then((list) => live && list && setFull((f) => ({ ...f, [open]: list })))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [open, full]);

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
  const cards = current ? (full[current.slug] ?? current.cards) : [];
  const list = cards.filter((c) => !sub || c.sub === sub);
  const listTotal = current ? (sub ? (current.subs.find((x) => x.slug === sub)?.count ?? list.length) : current.total) : 0;
  const shown = all ? list : list.slice(0, FIRST);

  return (
    <>
      <ul ref={tiles} className="sport-tiles" data-has-open={open ? '' : undefined}>
        {items.map((s, i) => (
          <li key={s.slug} style={{ ['--i' as string]: i }}>
            <button
              type="button"
              className="sport-tile"
              aria-label={t('{name}, {n} products', { name: s.name, n: s.total })}
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
                {t('{n} products', { n: s.total })}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div ref={panel} id="sport-panel" role="region" aria-label={current ? t('{name} shop', { name: current.name }) : t('Sport shop')} hidden={!current}>
        {current && (
          <div key={current.slug} className="sport-panel">
            <div className="flex items-start justify-between gap-3 px-1">
              <div className="min-w-0">
                <p className="eyebrow text-muted">{current.tagline}</p>
                <h3 className="display mt-2 text-[clamp(30px,6vw,64px)]">{current.name}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/${current.slug}`} className="eyebrow hidden items-center gap-2 px-2 py-2 hover:text-cobalt sm:inline-flex">
                  {t('Sport page')} <Icon name="arrow-right" size={14} />
                </Link>
                <button type="button" onClick={close} className="grid h-11 w-11 place-items-center rounded-full bg-stone transition-colors hover:bg-ink hover:text-white" aria-label={t('Close {name}', { name: current.name })}>
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            {current.best.length > 0 && (
              <section aria-labelledby="sp-best" className="mt-8">
                <h4 id="sp-best" className="sport-panel-h px-1">
                  {t('Best sellers')} <span className="text-muted">· {current.name}</span>
                </h4>
                <div className="mt-4">
                  <ProductGrid items={pick(current.best)} />
                </div>
              </section>
            )}

            {current.fresh.length > 0 && (
              <section aria-labelledby="sp-new" className="mt-10">
                <h4 id="sp-new" className="sport-panel-h px-1">
                  {t('New releases')} <span className="text-muted">· {current.name}</span>
                </h4>
                <div className="mt-4">
                  <ProductGrid items={pick(current.fresh)} />
                </div>
              </section>
            )}

            <section aria-labelledby="sp-all" className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3 px-1">
                <h4 id="sp-all" className="sport-panel-h">
                  {t('All {name}', { name: current.name.toLowerCase() })} <span className="text-muted">· {listTotal}</span>
                </h4>
              </div>
              {current.subs.length > 1 && (
                <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('{name} categories', { name: current.name })}>
                  {[{ slug: null, name: t('All'), count: current.total }, ...current.subs].map((x) => (
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
                {listTotal > FIRST && (
                  <button type="button" className="btn-holo h-12 px-7" aria-expanded={all} onClick={() => setAll((a) => !a)}>
                    {all ? t('Show less') : t('See all {n}', { n: listTotal })}
                  </button>
                )}
                <Link href={`/${current.slug}`} className="eyebrow inline-flex items-center gap-2 py-2 text-muted hover:text-cobalt">
                  {t('Open the {name} page', { name: current.name.toLowerCase() })} <Icon name="arrow-right" size={14} />
                </Link>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
