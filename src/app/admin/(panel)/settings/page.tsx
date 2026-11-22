import type { Metadata } from 'next';
import { SettingsView, SiteLinksForm } from '@/components/admin/SettingsView';
import { siteLinks } from '@/lib/site-links';
import { Card, PageHead, dateTime } from '@/components/admin/ui';
import { brand } from '@/config/brand';
import { requireAdmin } from '@/lib/admin/auth';
import { readOverrides, storeWritable } from '@/lib/store/overrides';
import { loadAdminData } from '@/lib/admin/orders';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await loadAdminData();
  await requireAdmin();
  const o = readOverrides();
  const rows: [string, string][] = [
    ['Store name', brand.name],
    ['Tagline', brand.tagline],
    ['Currency', `${brand.commerce.currency} · Algerian dinar`],
    ['Checkout', 'Cash on delivery · Algeria only (58 wilayas)'],
  ];
  return (
    <div className="adm-page adm-page-narrow">
      <PageHead title="Settings" />
      <div className="space-y-3">
        <Card title="Store details" action={<span className="text-[12px] text-[#66707c]">Set in src/config/brand.ts</span>}>
          <dl className="divide-y divide-[rgb(15_18_22/0.09)]">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]">
                <dt className="text-[#66707c]">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Social links & contact" action={<span className="text-[12px] text-[#66707c]">Shown in the site’s footer · no phone number</span>}>
          <SiteLinksForm initial={siteLinks()} />
        </Card>
        <Card title="Store data">
          <p className="text-[#4a525c]">
            Everything you change in the admin (products, stock, photos, delivery prices, orders) is saved in the store’s database on
            Cloudflare and shows on the site at once. Download a backup from time to time with Export.
          </p>
          <dl className="mt-3 grid gap-2 rounded-[10px] bg-[#f6f7f9] p-3 sm:grid-cols-4">
            {[
              ['Edited products', Object.keys(o.products).length],
              ['Added products', o.created.length],
              ['Deleted products', o.deleted.length],
              ['Orders with changes', Object.keys(o.orders).length],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] text-[#66707c]">{k}</dt>
                <dd className="num text-[16px] font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[12.5px] text-[#66707c]">
            {storeWritable() ? 'Saving is on.' : 'Read-only here (hosted).'} Last change: {o.updatedAt ? `${dateTime(o.updatedAt)} UTC` : 'none yet'}.
          </p>
          <SettingsView writable={storeWritable()} />
        </Card>
        <Card title="Security">
          <p className="text-[#4a525c]">
            The admin is protected by <span className="mono">ADMIN_PASSWORD</span> (in <span className="mono">.env.local</span> or your host’s environment
            settings). Sessions last 12 hours; changing the password signs everyone out.
          </p>
        </Card>
      </div>
    </div>
  );
}
