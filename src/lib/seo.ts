import 'server-only';
import { brand } from '@/config/brand';
import { SITE_URL, absolute } from '@/config/site';
import { renderUrl } from '@/lib/format';
import { availability } from '@/lib/catalog';
import type { Product } from '@/types/catalog';
import type { Locale } from '@/i18n/config';

/**
 * Search: the pieces that help the store come up for Algerian searches — titles and descriptions in
 * the visitor's language with the local terms people type ("prix en Algérie", "paiement à la
 * livraison", "58 wilayas"), Open Graph locales, and schema.org data (store, product + offer in DZD,
 * breadcrumbs) that matches what the page shows.
 */
export const OG_LOCALE: Record<Locale, string> = { fr: 'fr_DZ', ar: 'ar_DZ', en: 'en_US' };

/** "Venum" + "Venum boxing gloves" → "Venum boxing gloves" (no doubled brand in titles) */
export function productTitle(brandName: string, name: string) {
  return name.toLowerCase().startsWith(brandName.toLowerCase()) ? name : `${brandName} ${name}`;
}

export const productImages = (p: Product) => (p.images?.length ? p.images : [renderUrl(p.slug)]).map(absolute);

export function storeLd(description: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'OnlineStore',
        '@id': `${SITE_URL}/#store`,
        name: brand.name,
        url: `${SITE_URL}/`,
        logo: absolute('/brand/stryke-logo.webp'),
        description,
        areaServed: { '@type': 'Country', name: 'Algeria', identifier: 'DZ' },
        currenciesAccepted: 'DZD',
        paymentAccepted: 'Cash on delivery',
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: brand.name,
        publisher: { '@id': `${SITE_URL}/#store` },
        inLanguage: ['fr-DZ', 'ar-DZ', 'en'],
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: absolute(x.path) })),
  };
}

export function productLd(p: Product, brandName: string, description: string, category: string) {
  const a = availability(p);
  const url = absolute(`/product/${p.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: productTitle(brandName, p.name),
    url,
    image: productImages(p),
    description,
    sku: p.sku || p.slug,
    brand: { '@type': 'Brand', name: brandName },
    category,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: brand.commerce.currency,
      price: (p.price / 100).toFixed(0),
      availability: a === 'soon' ? 'https://schema.org/PreOrder' : a === 'out' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      areaServed: { '@type': 'Country', name: 'Algeria', identifier: 'DZ' },
      seller: { '@id': `${SITE_URL}/#store` },
    },
  };
}
