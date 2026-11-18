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
  const pathname = usePathname();
  const hydrated = useHydrated();
  const cartCount = useCartCount();
  const wishCount = useWishlist((s) => s.slugs.length);
  const { set, menuOpen } = useUi();
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
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
          className={`holo-border glass-strong pointer-events-auto flex w-full items-center gap-2 rounded-full pl-4 pr-1.5 transition-all duration-700 ease-[var(--ease-expo)] ${
            scrolled ? 'h-14 max-w-[1040px]' : 'h-16 max-w-[1240px]'
          }`}
          style={{ animation: 'header-in 1.1s .2s var(--ease-expo) both' }}
        >
          <Link href="/" className="text-[19px] md:text-[21px]" aria-label="SMADI home">
            <Wordmark />
          </Link>

          <nav aria-label="Sports" className="mx-auto hidden items-center gap-0.5 lg:flex">
            {nav.map((s) => {
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

          <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]" aria-label="Search products" onClick={() => set({ searchOpen: true })}>
              <Icon name="search" size={20} />
            </button>
            <Link href="/wishlist" className="relative grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/[0.06]" aria-label={`Wishlist${hydrated ? `, ${wishCount} items` : ''}`}>
              <Icon name="heart" size={20} />
              {hydrated && wishCount > 0 && <Badge n={wishCount} />}
            </Link>
            <button
              type="button"
              id="cart-button"
              className={`holo-border relative grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-[0_8px_20px_-10px_rgba(23,26,24,0.45)] transition-transform duration-300 ${bump ? 'scale-125' : ''}`}
              aria-label={`Open bag${hydrated ? `, ${cartCount} items` : ''}`}
              onClick={() => set({ cartOpen: true })}
            >
              <Icon name="bag" size={19} />
              {hydrated && cartCount > 0 && <Badge n={cartCount} accent />}
            </button>
            <button
              type="button"
              className="ml-0.5 grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink/[0.06] lg:hidden"
              aria-label="Open menu"
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
      className={`mono absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold ${
        accent ? 'bg-orange text-ink' : 'bg-ink text-white'
      }`}
    >
      {n > 99 ? '99' : n}
    </span>
  );
}
