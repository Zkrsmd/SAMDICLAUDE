import type { Metadata, Viewport } from 'next';
import { Archivo, Cairo, Geist_Mono, Sora } from 'next/font/google';
import { brand } from '@/config/brand';
import { dirOf } from '@/i18n/config';
import { getLocaleInfo, getT } from '@/i18n/server';
import { SITE_URL } from '@/config/site';
import { OG_LOCALE } from '@/lib/seo';
import 'lenis/dist/lenis.css';
import './globals.css';

// action display: Archivo, heavy, condensed (wdth axis) and slanted — the language of sports ads
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], style: ['italic'], variable: '--font-display-face', display: 'swap' });
const sans = Sora({ subsets: ['latin'], variable: '--font-sans-face', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono-face', display: 'swap' });
// Arabic text (the store in Arabic): Cairo, for body and display
const arabic = Cairo({ subsets: ['arabic', 'latin'], weight: ['400', '600', '800', '900'], variable: '--font-arabic-face', display: 'swap' });

/** Titles and descriptions in the visitor's language (French for search engines, see DEFAULT_LOCALE). */
export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getLocaleInfo();
  const t = await getT();
  const title = `${brand.name} — ${t('Sports store in Algeria')}`;
  const description = t('Football jerseys, boxing gloves, swimming, fitness and more — prices in DA, cash on delivery to all 58 wilayas.');
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${brand.name}` },
    description,
    applicationName: brand.name,
    openGraph: { siteName: brand.name, type: 'website', locale: OG_LOCALE[locale], title, description, url: '/' },
    twitter: { card: 'summary_large_image', title, description },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F3F4F6',
};

/** The document shell shared by the store ((store)/layout.tsx) and the admin (admin/layout.tsx). */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // the visitor's language; no choice yet → the picker opens first (data-lang-gate holds the intro)
  const { locale, chosen } = await getLocaleInfo();
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      data-lang-gate={chosen ? undefined : ''}
      className={`${display.variable} ${sans.variable} ${mono.variable} ${arabic.variable}`}
    >
      <body className="grain">
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}'}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
