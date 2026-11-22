/**
 * The public address of the store, used for canonical links, the sitemap, Open Graph and structured
 * data. A server-only variable (not NEXT_PUBLIC_: those are frozen into the build from .env files);
 * without it, the live Cloudflare address.
 */
export const SITE_URL = (process.env.SITE_URL || 'https://smadi.zkrsmdndr.workers.dev').replace(/\/+$/, '');
export const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`);
