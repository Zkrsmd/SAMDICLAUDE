'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/ui/Wordmark';
import { Icon } from '@/components/ui/Icon';
import { useCartCount } from '@/stores/cart';
import { useWishlist } from '@/stores/lists';
import { useUi } from '@/stores/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { MobileMenu } from './MobileMenu';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useT } from '@/i18n/client';

export interface NavSport {
  slug: string;
  name: string;
  tier: 'major' | 'minor';
  subs: { slug: string; name: string }[];
}

/**
 * Floating midnight-cobalt bar: soft cobalt lights drift inside it and a glint of light travels round
 * its rim (all CSS transforms). It stays with you on scroll and tightens once you leave the top.
 */
export function Header({ nav }: { nav: NavSport[] }) {
  const t = useT();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const cartCount = useCartCount();
  const wishCount = useWishlist((s) => s.slugs.length);
  const { set, menuOpen } = useUi();
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    // a 1px marker 40px down the page: no scroll handler, no layout reads while scrolling
    const mark = document.createElement('div');
    mark.setAttribute('aria-hidden', 'true');
    mark.style.cssText = 'position:absolute;top:40px;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden';
    document.body.prepend(mark);
    const io = new IntersectionObserver(([e]) => setScrolled(!!e && !e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(mark);
    return () => {
      io.disconnect();
      mark.remove();
    };
  }, []);

  // little pop whenever the bag count changes
  useEffect(() => {
    if (!hydrated || !cartCount) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 600);
    return () => window.clearTimeout(t);
  }, [cartCount, hydrated]);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3" style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <div
          className={`hdr pointer-events-auto flex w-full items-center gap-2 rounded-full ps-5 pe-1.5 transition-all duration-700 ease-[var(--ease-expo)] ${
            scrolled ? 'h-14 max-w-[1040px]' : 'h-16 max-w-[1240px]'
          }`}
          style={{ animation: 'header-in 1.1s .2s var(--ease-expo) both' }}
        >
          <span aria-hidden className="hdr-aurora" />
          <Link href="/" className="text-[19px] md:text-[21px]" aria-label={t('STRYKE home')}>
            <Wordmark />
          </Link>

          <nav aria-label={t('Sports')} className="mx-auto hidden items-center gap-0.5 lg:flex">
            {nav.filter((s) => s.tier === 'major').map((s) => {
              const active = pathname.startsWith(`/${s.slug}`);
              return (
                <Link
                  key={s.slug}
                  href={`/${s.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative rounded-full px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                    active ? 'bg-white text-[#0b1534] shadow-[0_4px_14px_-6px_rgba(43,89,255,0.8)]' : 'text-white/70 hover:text-white'
                  }`}
                >
                  <span className="relative z-10">{s.name}</span>
                  {!active && (
                    <span aria-hidden className="absolute inset-0 scale-75 rounded-full bg-white/10 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-0.5 lg:ms-0">
            <LanguageSwitcher className="me-1 hidden lg:inline-flex" />
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-white/10" aria-label={t('Search products')} onClick={() => set({ searchOpen: true })}>
              <Icon name="search" size={20} />
            </button>
            <Link href="/wishlist" className="relative grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-white/10" aria-label={hydrated ? t('Wishlist, {n} items', { n: wishCount }) : t('Wishlist')}>
              <Icon name="heart" size={20} />
              {hydrated && wishCount > 0 && <Badge n={wishCount} />}
            </Link>
            <button
              type="button"
              id="cart-button"
              className={`hdr-bag relative grid h-11 w-11 place-items-center rounded-full transition-transform duration-300 ${bump ? 'scale-125' : ''}`}
              aria-label={hydrated ? t('Open bag, {n} items', { n: cartCount }) : t('Open bag')}
              onClick={() => set({ cartOpen: true })}
            >
              <Icon name="bag" size={19} />
              {hydrated && cartCount > 0 && <Badge n={cartCount} accent />}
            </button>
            <button
              type="button"
              className="ms-0.5 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
              aria-label={t('Open menu')}
              aria-expanded={menuOpen}
              onClick={() => set({ menuOpen: true })}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu nav={nav} />
    </>
  );
}

function Badge({ n, accent }: { n: number; accent?: boolean }) {
  return (
    <span
      aria-hidden
      // sits on the top corner of the icon button, above everything in it
      className={`pointer-events-none absolute -end-1 -top-1 z-10 grid h-[19px] min-w-[19px] place-items-center rounded-full px-1 font-mono text-[10px] font-bold leading-none tabular-nums ring-2 ring-[#0b1534] ${
        accent ? 'bg-white text-[#1d3fd0]' : 'bg-cobalt text-white'
      }`}
    >
      {n > 99 ? '99' : n}
    </span>
  );
}
