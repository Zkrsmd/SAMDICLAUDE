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
 * Floating glass pill with an animated holographic glow border. It stays with you on scroll,
 * tightens and brightens once you leave the top of the page.
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
          className={`glass-pill pointer-events-auto flex w-full items-center gap-2 rounded-full ps-5 pe-1.5 transition-all duration-700 ease-[var(--ease-expo)] ${
            scrolled ? 'h-14 max-w-[1040px]' : 'h-16 max-w-[1240px]'
          }`}
          style={{ animation: 'header-in 1.1s .2s var(--ease-expo) both' }}
        >
          <LiquidChrome />
          <Link href="/" className="text-[19px] md:text-[21px]" aria-label={t('REVO home')}>
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
                    active ? 'bg-white text-ink shadow-[0_4px_14px_-6px_rgba(23,26,24,0.4)] ring-1 ring-ink/10' : 'text-ink/75 hover:text-ink'
                  }`}
                >
                  <span className="relative z-10">{s.name}</span>
                  {!active && (
                    <span aria-hidden className="absolute inset-0 scale-75 rounded-full bg-ink/[0.06] opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-0.5 lg:ms-0">
            <LanguageSwitcher className="me-1 hidden lg:inline-flex" />
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]" aria-label={t('Search products')} onClick={() => set({ searchOpen: true })}>
              <Icon name="search" size={20} />
            </button>
            <Link href="/wishlist" className="relative grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]" aria-label={hydrated ? t('Wishlist, {n} items', { n: wishCount }) : t('Wishlist')}>
              <Icon name="heart" size={20} />
              {hydrated && wishCount > 0 && <Badge n={wishCount} />}
            </Link>
            <button
              type="button"
              id="cart-button"
              className={`glass-bubble relative grid h-11 w-11 place-items-center rounded-full text-ink transition-transform duration-300 ${bump ? 'scale-125' : ''}`}
              aria-label={hydrated ? t('Open bag, {n} items', { n: cartCount }) : t('Open bag')}
              onClick={() => set({ cartOpen: true })}
            >
              <Icon name="bag" size={19} />
              {hydrated && cartCount > 0 && <Badge n={cartCount} accent />}
            </button>
            <button
              type="button"
              className="ms-0.5 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/[0.06] lg:hidden"
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
      className={`pointer-events-none absolute -end-1 -top-1 z-10 grid h-[19px] min-w-[19px] place-items-center rounded-full px-1 font-mono text-[10px] font-bold leading-none tabular-nums ring-2 ring-white ${
        accent ? 'bg-cobalt text-white' : 'bg-ink text-white'
      }`}
    >
      {n > 99 ? '99' : n}
    </span>
  );
}

/**
 * The header's liquid metal: fractal noise folded into bright/dark reflection bands (the way
 * polished mercury mirrors its own waves), tinted steel. It is drawn once and only slides (CSS).
 */
function LiquidChrome() {
  return (
    <span aria-hidden className="chrome-liquid">
      <svg className="chrome-liquid-sheet" preserveAspectRatio="none" focusable="false">
        <filter id="revo-liquid-chrome" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.022" numOctaves="2" seed="11" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0.55 0.45 0 0 0  0.55 0.45 0 0 0  0.55 0.45 0 0 0  0 0 0 0 1"
            result="grey"
          />
          <feComponentTransfer in="grey">
            <feFuncR type="table" tableValues="0.5 0.97 0.3 1 0.26 0.88 0.4 1 0.48" />
            <feFuncG type="table" tableValues="0.54 0.98 0.34 1 0.3 0.91 0.44 1 0.52" />
            <feFuncB type="table" tableValues="0.62 1 0.43 1 0.4 0.97 0.54 1 0.6" />
          </feComponentTransfer>
        </filter>
        <rect width="100%" height="100%" filter="url(#revo-liquid-chrome)" />
      </svg>
    </span>
  );
}
