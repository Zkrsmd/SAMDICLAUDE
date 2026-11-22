import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CustomerEditor } from '@/components/admin/CustomerEditor';
import { Badge, Card, PageHead, StatusBadge, day, money } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getCustomers, getOrders, loadAdminData } from '@/lib/admin/orders';
import { readOverrides, storeWritable } from '@/lib/store/overrides';
import { formatPhone } from '@/lib/validation/order';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Customer' };

/** One customer (known by their phone): contact, notes and tags, their orders and what they spent. */
export default async function CustomerPage({ params }: Props) {
  await loadAdminData();
  await requireAdmin();
  const id = decodeURIComponent((await params).id);
  const c = getCustomers().find((x) => x.id === id);
  if (!c) notFound();
  const orders = getOrders().filter((o) => o.customer.id === id);
  const phone = c.phone ?? '';
  const profile = (phone && readOverrides().customers?.[phone]) || { note: '', tags: [] };
  const real = !!phone && orders.some((o) => o.cod);
  const refused = orders.filter((o) => o.cod?.status === 'returned').length;
  const cancelled = orders.filter((o) => o.cod?.status === 'cancelled').length;
  const delivered = orders.filter((o) => o.cod?.status === 'delivered').length;
  return (
    <div className="adm-page adm-page-narrow">
      <PageHead title={c.name} back="/admin/customers" meta={<span className="flex gap-1.5">{profile.tags.map((t) => <Badge key={t}>{t}</Badge>)}</span>} />
      <p className="-mt-3 mb-4 text-[#66707c]">
        Customer since {day(c.first)} · {c.city}
      </p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Orders', String(c.orders)],
              ['Spent', money(c.spent)],
              ['Delivered', String(delivered)],
              ['Returned / cancelled', `${refused} / ${cancelled}`],
            ].map(([l, v]) => (
              <div key={l} className="adm-card adm-card-pad">
                <p className="text-[12.5px] text-[#66707c]">{l}</p>
                <p className="num mt-1 text-[18px] font-bold">{v}</p>
              </div>
            ))}
          </div>
          <Card title="Orders" pad={false}>
            <ul className="divide-y divide-[rgb(15_18_22/0.09)]">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f7f8fa]">
                    <span className="num w-16 font-semibold">#{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-[#4a525c]">
                      {o.items} item{o.items === 1 ? '' : 's'} · {o.lines.map((l) => l.name).join(', ')}
                    </span>
                    <span className="hidden text-[12.5px] text-[#66707c] sm:inline">{day(o.createdAt)}</span>
                    <StatusBadge status={o.cod?.status ?? o.fulfillment} />
                    <span className="num w-24 text-right font-medium">{money(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-3">
          <Card title="Contact">
            {phone ? (
              <>
                <p className="num text-[15px] font-semibold">{formatPhone(phone)}</p>
                <p className="mt-1 flex gap-3 text-[12.5px]">
                  <a href={`tel:${phone}`} className="adm-link">
                    Call
                  </a>
                  <a href={`sms:${phone}`} className="adm-link">
                    SMS
                  </a>
                  <a href={`https://wa.me/213${phone.slice(1)}`} target="_blank" rel="noopener noreferrer" className="adm-link">
                    WhatsApp
                  </a>
                </p>
              </>
            ) : (
              <p className="break-all">{c.email}</p>
            )}
            <p className="mt-3 text-[12px] font-semibold text-[#66707c]">Location</p>
            <p>{c.city}</p>
          </Card>
          {real ? (
            <CustomerEditor phone={phone} name={c.name} profile={profile} writable={storeWritable()} />
          ) : (
            <Card title="Sample customer">
              <p className="text-[#66707c]">Made from the sample orders. Real customers can be edited once real orders come in.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
