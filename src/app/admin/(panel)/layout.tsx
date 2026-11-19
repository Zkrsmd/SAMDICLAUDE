import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/admin/auth';
import { getOrders } from '@/lib/admin/orders';
import { getAdminProducts } from '@/lib/catalog';
import { storeWritable } from '@/lib/store/overrides';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const orders = getOrders();
  const index = {
    products: getAdminProducts().map((p) => ({ slug: p.slug, name: p.name, brandName: p.brandName, image: p.image, status: p.status })),
    orders: orders.slice(0, 400).map((o) => ({ id: o.id, number: o.number, customer: o.customer.name })),
  };
  const unfulfilled = orders.filter((o) => o.fulfillment === 'unfulfilled' && !o.archived && o.payment !== 'refunded').length;
  return (
    <AdminShell unfulfilled={unfulfilled} index={index} writable={storeWritable()}>
      {children}
    </AdminShell>
  );
}
