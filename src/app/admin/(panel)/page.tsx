import type { Metadata } from 'next';
import Link from 'next/link';
import { BarList, SalesChart, Sparkline } from '@/components/admin/charts';
import { AIcon, Card, PageHead, RangeTabs, SampleNote, StatusBadge, Thumb, day, money, pct } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { RANGES, getOrders, parseRange, report, showingSamples } from '@/lib/admin/orders';
import { getAdminProducts } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Home' };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const range = parseRange((await searchParams).range);
  const r = report(RANGES[range]);
  const orders = getOrders();
  const products = getAdminProducts();
  const open = orders.filter((o) => !o.archived && o.payment !== 'refunded');
  const toFulfil = open.filter((o) => o.fulfillment === 'unfulfilled').length;
  const pending = open.filter((o) => o.payment === 'pending').length;
  const low = products.filter((p) => p.status === 'active' && p.sizes.some((s) => (p.stock[s] ?? 0) <= 3)).length;
  const out = products.filter((p) => p.status === 'active' && p.sizes.every((s) => (p.stock[s] ?? 0) <= 0)).length;
  const drafts = products.filter((p) => p.status === 'draft').length;
  const hour = new Date().getUTCHours();

  const kpis = [
    { label: 'Total sales', value: money(r.sales), delta: r.delta.sales, spark: r.series.map((p) => p.sales) },
    { label: 'Orders', value: String(r.orders), delta: r.delta.orders, spark: r.series.map((p) => p.orders) },
    { label: 'Average order value', value: money(r.aov), delta: r.delta.aov, spark: r.series.map((p) => (p.orders ? p.sales / p.orders : 0)) },
    { label: 'Items sold', value: String(r.items), delta: r.delta.items, spark: r.series.map((p) => p.orders) },
  ];
  const todo = [
    { n: toFulfil, label: `order${toFulfil === 1 ? '' : 's'} to fulfil`, href: '/admin/orders?tab=unfulfilled', icon: 'truck' as const },
    { n: pending, label: `payment${pending === 1 ? '' : 's'} pending`, href: '/admin/orders?tab=unpaid', icon: 'orders' as const },
    { n: low, label: `product${low === 1 ? '' : 's'} low in stock`, href: '/admin/inventory?filter=low', icon: 'inventory' as const },
    { n: out, label: `product${out === 1 ? '' : 's'} sold out`, href: '/admin/inventory?filter=out', icon: 'alert' as const },
    { n: drafts, label: `draft${drafts === 1 ? '' : 's'} not on sale`, href: '/admin/products?tab=draft', icon: 'products' as const },
  ].filter((t) => t.n > 0);

  return (
    <div className="adm-page">
      <PageHead title={hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}>
        <RangeTabs range={range} base="/admin" />
      </PageHead>
      {showingSamples() ? (
        <SampleNote>
          Orders, customers and sales here are <strong>sample data</strong> until the first real order comes in from the checkout. Products, prices,
          stock and everything you edit are real and show on the store.
        </SampleNote>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="adm-card adm-card-pad">
            <p className="text-[12.5px] font-medium text-[#66707c]">{k.label}</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
              <p className="num text-[19px] font-bold tracking-tight md:text-[22px]">{k.value}</p>
              <span className={`num text-[12px] font-semibold ${k.delta === null ? 'text-[#8a939e]' : k.delta >= 0 ? 'text-[#136c3a]' : 'text-[#b42318]'}`}>
                {k.delta !== null && (k.delta >= 0 ? '↑' : '↓')} {pct(k.delta === null ? null : Math.abs(k.delta))}
              </span>
            </div>
            <div className="mt-2">
              <Sparkline values={k.spark} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Sales over time" action={<Link href={`/admin/analytics?range=${range}`} className="adm-link text-[12.5px]">View report</Link>}>
          <SalesChart series={r.series} />
        </Card>
        <Card title="Things to do">
          {todo.length ? (
            <ul className="-mx-2 space-y-0.5">
              {todo.map((t) => (
                <li key={t.label}>
                  <Link href={t.href} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[#f5f6f8]">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1f3f5]">
                      <AIcon name={t.icon} size={16} />
                    </span>
                    <span className="flex-1">
                      <strong className="num">{t.n}</strong> {t.label}
                    </span>
                    <AIcon name="chevron-right" size={16} className="text-[#8a939e]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[#66707c]">All caught up.</p>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="Top products" action={<span className="text-[12px] text-[#66707c]">by sales</span>}>
          <ul className="-mx-1">
            {r.topProducts.slice(0, 6).map((p, i) => (
              <li key={p.slug}>
                <Link href={`/admin/products/${p.slug}`} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-[#f5f6f8]">
                  <span className="num w-4 text-[12px] text-[#8a939e]">{i + 1}</span>
                  <Thumb src={p.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-[12px] text-[#66707c]">
                      {p.brandName} · {p.units} sold
                    </span>
                  </span>
                  <span className="num font-semibold">{money(p.sales)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Sales by sport">
          <BarList rows={r.bySport} />
        </Card>
      </div>

      <Card className="mt-3" pad={false} title="Recent orders" action={<Link href="/admin/orders" className="adm-link text-[12.5px]">All orders</Link>}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Payment</th>
                <th>Fulfilment</th>
                <th className="r">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 6).map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold hover:underline">
                      #{o.number}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-[#4a525c]">{day(o.createdAt)}</td>
                  <td className="whitespace-nowrap">{o.customer.name}</td>
                  <td>
                    <StatusBadge status={o.payment} />
                  </td>
                  <td>
                    <StatusBadge status={o.fulfillment} />
                  </td>
                  <td className="num r font-medium">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
