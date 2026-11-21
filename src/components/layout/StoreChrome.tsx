import { getSports } from '@/lib/catalog';
import { Header } from '@/components/header/Header';
import { Footer } from '@/components/footer/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { FlyToCart } from '@/components/cart/FlyToCart';
import { RouteCurtain } from '@/components/layout/RouteCurtain';
import { Effects } from '@/components/layout/Effects';
import { SmoothScroll } from '@/components/layout/SmoothScroll';
import { LanguageGate } from '@/components/i18n/LanguageGate';
import { I18nProvider } from '@/i18n/client';
import { DICTS } from '@/i18n/dictionaries';
import { makeT } from '@/i18n/config';
import { getLocaleInfo } from '@/i18n/server';

/** Everything around a storefront page: header, footer, bag, search, the language and the site-wide effects. */
export async function StoreChrome({ children }: { children: React.ReactNode }) {
  const { locale, chosen } = await getLocaleInfo();
  const t = makeT(DICTS[locale]);
  const nav = getSports().map((s) => ({ slug: s.slug, name: t(s.name), tier: s.tier, subs: s.subs.map((x) => ({ slug: x.slug, name: t(x.name) })) }));
  return (
    <I18nProvider locale={locale} dict={DICTS[locale]}>
      <a href="#main" className="sr-only-focusable fixed start-3 top-3 z-[100] bg-ink px-4 py-2 text-white">
        {t('Skip to content')}
      </a>
      <Header nav={nav} />
      <main id="main">{children}</main>
      <Footer nav={nav} />
      <CartDrawer />
      <SearchOverlay />
      <FlyToCart />
      <RouteCurtain />
      <Effects />
      <SmoothScroll />
      {!chosen && <LanguageGate />}
    </I18nProvider>
  );
}
