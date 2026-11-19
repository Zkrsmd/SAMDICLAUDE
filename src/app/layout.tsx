import type { Metadata, Viewport } from 'next';
import { Archivo, Geist_Mono, Sora } from 'next/font/google';
import { brand } from '@/config/brand';
import 'lenis/dist/lenis.css';
import './globals.css';

// action display: Archivo, heavy, condensed (wdth axis) and slanted — the language of sports ads
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], style: ['italic'], variable: '--font-display-face', display: 'swap' });
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

/** The document shell shared by the store ((store)/layout.tsx) and the admin (admin/layout.tsx). */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="grain">
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}'}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
