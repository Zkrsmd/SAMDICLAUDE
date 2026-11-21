import type { Metadata } from 'next';
import Link from 'next/link';
import { BarList, SalesChart } from '@/components/admin/charts';
import { Card, PageHead, RangeTabs, SampleNote, Thumb, money, pct } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { RANGES, parseRange, report, showingSamples } from '@/lib/admin/orders';
import { loadAdminData } from '@/lib/admin/orders';

export const metadata: Metadata = { title: 'Analytics' };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await loadAdminData();
  await requireAdmin();
  const range = parseRange((await searchParams).range);
  const r = report(RANGES[range]);
  const stats = [
    ['Total sales', money(r.sales), r.delta.sales],
    ['Orders', String(r.orders), r.delta.orders],
    ['Average order value', money(r.aov), r.delta.aov],
    ['Items sold', String(r.items), r.delta.items],
    ['Returning customers', `${Math.round(r.returningRate * 100)}%`, null],
  ] as const;
  return (
    <div className="adm-page">
      <PageHead title="Analytics">
        <RangeTabs range={range} base="/admin/analytics" />
      </PageHead>
      {showingSamples() ? <SampleNote>Reports are built from the sample orders, compared with the {r.days} days before.</SampleNote> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([label, value, delta]) => (
          <div key={label} className="adm-card adm-card-pad">
            <p className="text-[12.5px] text-[#66707c]">{label}</p>
            <p className="num mt-1 text-[18px] font-bold">{value}</p>
            <p className={`num text-[12px] font-semibold ${delta === null ? 'text-[#8a939e]' : delta >= 0 ? 'text-[#136c3a]' : 'text-[#b42318]'}`}>
              {delta === null ? 'last ' + r.days + ' days' : `${delta >= 0 ? '↑' : '↓'} ${pct(Math.abs(delta))}`}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Sales over time">
          <SalesChart series={r.series} height={220} />
        </Card>
        <Card title="Orders over time">
          <SalesChart series={r.series} metric="orders" height={220} />
        </Card>
        <Card title="Sales by sport">
          <BarList rows={r.bySport} />
        </Card>
        <Card title="Sales by vendor">
          <BarList rows={r.byBrand} />
        </Card>
        <Card title="Sales by channel">
          <BarList rows={r.byChannel} />
        </Card>
        <Card title="Top products" pad={false}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="r">Units</th>
                  <th className="r">Sales</th>
                </tr>
              </thead>
              <tbody>
                {r.topProducts.map((p) => (
                  <tr key={p.slug}>
                    <td>
                      <Link href={`/admin/products/${p.slug}`} className="flex items-center gap-3 hover:underline">
                        <Thumb src={p.image} />
                        <span className="line-clamp-1 font-medium">{p.name}</span>
                      </Link>
                    </td>
                    <td className="num r">{p.units}</td>
                    <td className="num r font-medium">{money(p.sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
