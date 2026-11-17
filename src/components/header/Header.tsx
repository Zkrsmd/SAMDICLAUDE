'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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

export function Header({ nav }: { nav: NavSport[] }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const cartCount = useCartCount();
  const wishCount = useWishlist((s) => s.slugs.length);
  const { set, menuOpen } = useUi();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const overHero = pathname === '/' && !scrolled;

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 240 && y > lastY.current + 4 && !menuOpen);
      if (y < lastY.current - 4) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuOpen]);

  const major = nav.filter((s) => s.tier === 'major');
  const minor = nav.filter((s) => s.tier === 'minor');

  return (
    <>
      <header
        data-over-hero={overHero}
        className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,box-shadow] duration-500 ease-[var(--ease-expo)] ${
          hidden ? '-translate-y-full' : 'translate-y-0'
        } ${overHero ? 'bg-transparent' : 'bg-bg/85 shadow-[0_1px_0_rgb(23_26_24/0.08)] backdrop-blur-xl'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container-x flex h-14 items-center gap-3 md:h-16">
          <button
            type="button"
            className="-ml-2 grid h-11 w-11 place-items-center lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => set({ menuOpen: true })}
          >
            <Icon name="menu" />
          </button>
          <Link href="/" className="text-[22px] md:text-[26px]" aria-label="Home">
            <Wordmark />
          </Link>

          <nav aria-label="Sports" className="ml-10 hidden items-center gap-1 lg:flex">
            {major.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                aria-current={pathname.startsWith(`/${s.slug}`) ? 'page' : undefined}
                className="eyebrow rounded-[2px] px-3 py-2 transition-colors hover:bg-ink/5 aria-[current=page]:text-orange"
              >
                {s.name}
              </Link>
            ))}
            <span className="mx-2 h-4 w-px bg-line" aria-hidden />
            {minor.map((s) => (
              <Link
                key={s.slug}
                href={`/${s.slug}`}
                aria-current={pathname.startsWith(`/${s.slug}`) ? 'page' : undefined}
                className="eyebrow rounded-[2px] px-3 py-2 text-muted transition-colors hover:bg-ink/5 hover:text-ink aria-[current=page]:text-orange"
              >
                {s.name}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center">
            <button
              type="button"
              className="grid h-11 w-11 place-items-center"
              aria-label="Search products"
              onClick={() => set({ searchOpen: true })}
            >
              <Icon name="search" />
            </button>
            <Link href="/wishlist" className="relative grid h-11 w-11 place-items-center" aria-label={`Wishlist${hydrated ? `, ${wishCount} items` : ''}`}>
              <Icon name="heart" />
              {hydrated && wishCount > 0 && <Badge n={wishCount} />}
            </Link>
            <button
              type="button"
              id="cart-button"
              className="relative -mr-2 grid h-11 w-11 place-items-center"
              aria-label={`Open bag${hydrated ? `, ${cartCount} items` : ''}`}
              onClick={() => set({ cartOpen: true })}
            >
              <Icon name="bag" />
              {hydrated && cartCount > 0 && <Badge n={cartCount} accent />}
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
      className={`mono absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold text-white ${
        accent ? 'bg-orange' : 'bg-ink'
      }`}
    >
      {n > 99 ? '99' : n}
    </span>
  );
}
