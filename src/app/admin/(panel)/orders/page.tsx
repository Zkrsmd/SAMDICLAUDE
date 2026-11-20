import type { Metadata } from 'next';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { PageHead, SampleNote } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getOrders, showingSamples } from '@/lib/admin/orders';

export const metadata: Metadata = { title: 'Orders' };

export default async function OrdersPage() {
  await requireAdmin();
  const rows = getOrders().map((o) => ({
    id: o.id,
    number: o.number,
    createdAt: o.createdAt,
    customer: o.customer.name,
    channel: o.channel,
    items: o.items,
    total: o.total,
    payment: o.payment,
    fulfillment: o.fulfillment,
    archived: o.archived,
    status: o.cod?.status,
    phone: o.cod?.phone,
    wilaya: o.cod ? `${o.cod.wilayaName}` : undefined,
  }));
  return (
    <div className="adm-page">
      <PageHead title="Orders" />
      {showingSamples() ? (
        <SampleNote>
          Sample orders, shown until the first real order comes in from the checkout (then they disappear). Real orders are kept in{' '}
          <span className="mono">.data/orders.json</span>, never in git.
        </SampleNote>
      ) : null}
      <OrdersTable rows={rows} />
    </div>
  );
}
