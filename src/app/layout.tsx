import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Sora, Unbounded } from 'next/font/google';
import { brand } from '@/config/brand';
import { getSports, searchIndex } from '@/lib/catalog';
import { Header } from '@/components/header/Header';
import { Footer } from '@/components/footer/Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { FlyToCart } from '@/components/cart/FlyToCart';
import { RouteCurtain } from '@/components/layout/RouteCurtain';
import { Effects } from '@/components/layout/Effects';
import './globals.css';

const display = Unbounded({ subsets: ['latin'], variable: '--font-display-face', display: 'swap' });
const sans = Sora({ subsets: ['latin'], variable: '--font-sans-face', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono-face', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: `${brand.name} — ${brand.tagline}`, template: `%s — ${brand.name}` },
  description: brand.description,
  openGraph: { siteName: brand.name, type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F3F4F6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = getSports().map((s) => ({ slug: s.slug, name: s.name, tier: s.tier, subs: s.subs.map((x) => ({ slug: x.slug, name: x.name })) }));
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="grain">
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}'}</style>
        </noscript>
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
      </body>
    </html>
  );
}
