import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/site';
import { ensureStore, getAllProducts, getSports } from '@/lib/catalog';

// built per request from the live catalogue (admin changes included)
export const dynamic = 'force-dynamic';

/** Every public page: home, each sport, each of its categories, each product. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await ensureStore();
  const out: MetadataRoute.Sitemap = [{ url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 }];
  for (const s of getSports()) {
    out.push({ url: `${SITE_URL}/${s.slug}`, changeFrequency: 'daily', priority: 0.9 });
    for (const x of s.subs) out.push({ url: `${SITE_URL}/${s.slug}/${x.slug}`, changeFrequency: 'daily', priority: 0.8 });
  }
  for (const p of getAllProducts()) out.push({ url: `${SITE_URL}/product/${p.slug}`, changeFrequency: 'weekly', priority: p.comingSoon ? 0.5 : 0.7 });
  return out;
}
