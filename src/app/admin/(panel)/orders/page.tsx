import type { Metadata } from 'next';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { PageHead, SampleNote } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getOrders } from '@/lib/admin/orders';

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
  }));
  return (
    <div className="adm-page">
      <PageHead title="Orders" />
      <SampleNote>
        Sample orders (the checkout doesn’t take orders yet). Fulfilment, archiving and notes you set here are saved.
      </SampleNote>
      <OrdersTable rows={rows} />
    </div>
  );
}
