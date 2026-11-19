import { getSports, searchIndex } from '@/lib/catalog';
import { Header } from '@/components/header/Header';
import { Footer } from '@/components/footer/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { FlyToCart } from '@/components/cart/FlyToCart';
import { RouteCurtain } from '@/components/layout/RouteCurtain';
import { Effects } from '@/components/layout/Effects';
import { SmoothScroll } from '@/components/layout/SmoothScroll';

/** Everything around a storefront page: header, footer, bag, search and the site-wide effects. */
export function StoreChrome({ children }: { children: React.ReactNode }) {
  const nav = getSports().map((s) => ({ slug: s.slug, name: s.name, tier: s.tier, subs: s.subs.map((x) => ({ slug: x.slug, name: x.name })) }));
  return (
    <>
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[100] bg-ink px-4 py-2 text-white">
        Skip to content
      </a>
      <Header nav={nav} />
      <main id="main">{children}</main>
      <Footer nav={nav} />
      <CartDrawer />
      <SearchOverlay index={searchIndex()} />
      <FlyToCart />
      <RouteCurtain />
      <Effects />
      <SmoothScroll />
    </>
  );
}
