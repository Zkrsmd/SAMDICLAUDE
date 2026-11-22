import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/site';

/** Crawl the store; skip the admin, the API and the private / per-visitor pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/cart', '/checkout', '/order/', '/wishlist', '/search'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
