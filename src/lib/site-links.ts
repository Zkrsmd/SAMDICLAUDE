import 'server-only';
import { brand } from '@/config/brand';
import { readOverrides } from '@/lib/store/overrides';
import type { SiteSettings } from '@/lib/validation/admin';

/** The shop's links and e-mail for the footer: what was set in Admin → Settings, else the defaults in src/config/brand.ts. */
export function siteLinks(): SiteSettings {
  const d = Object.fromEntries(brand.social.map((s) => [s.id, s.href])) as Record<'facebook' | 'instagram' | 'tiktok', string>;
  const o = readOverrides().site;
  return {
    email: o?.email ?? '',
    facebook: o ? o.facebook : d.facebook,
    instagram: o ? o.instagram : d.instagram,
    tiktok: o ? o.tiktok : d.tiktok,
  };
}
