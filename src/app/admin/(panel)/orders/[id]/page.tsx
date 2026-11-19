import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OrderActions, OrderNotes } from '@/components/admin/OrderView';
import { AIcon, Badge, Card, PageHead, StatusBadge, Thumb, dateTime, longDate, money } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getOrder, getOrders } from '@/lib/admin/orders';
import { storeWritable } from '@/lib/store/overrides';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = getOrder((await params).id);
  return { title: o ? `Order #${o.number}` : 'Order' };
}

export default async function OrderPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const o = getOrder(id);
  if (!o) notFound();
  const all = getOrders();
  const i = all.findIndex((x) => x.id === o.id);
  const newer = all[i - 1];
  const older = all[i + 1];
  const history = all.filter((x) => x.customer.id === o.customer.id);
  const events = [
    ...o.notes.map((n) => ({ at: n.at, text: n.text, note: true })),
    { at: o.createdAt, text: `Order placed on ${o.channel}`, note: false },
    ...(o.payment === 'paid' ? [{ at: o.createdAt, text: `Payment of ${money(o.total)} captured`, note: false }] : []),
    ...(o.payment === 'refunded' ? [{ at: o.createdAt, text: `Refunded ${money(o.total)}`, note: false }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="adm-page adm-page-narrow">
      <PageHead
        title={`#${o.number}`}
        back="/admin/orders"
        meta={
          <span className="flex gap-1.5">
            <StatusBadge status={o.payment} />
            {o.archived ? <Badge>Archived</Badge> : <StatusBadge status={o.fulfillment} />}
          </span>
        }
      >
        <span className="flex items-center gap-1">
          {newer ? (
            <Link href={`/admin/orders/${newer.id}`} className="adm-icon-btn" aria-label={`Newer order #${newer.number}`}>
              <AIcon name="chevron-left" />
            </Link>
          ) : null}
          {older ? (
            <Link href={`/admin/orders/${older.id}`} className="adm-icon-btn" aria-label={`Older order #${older.number}`}>
              <AIcon name="chevron-right" />
            </Link>
          ) : null}
        </span>
      </PageHead>
      <p className="-mt-3 mb-4 text-[#66707c]">
        {longDate(o.createdAt)} · {o.channel}
      </p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <Card
            title={
              <span className="flex items-center gap-2">
                <StatusBadge status={o.fulfillment} /> {o.items} item{o.items === 1 ? '' : 's'}
              </span>
            }
          >
            <ul className="divide-y divide-[rgb(15_18_22/0.09)]">
              {o.lines.map((l) => (
                <li key={l.slug} className="flex items-center gap-3 py-3">
                  <Thumb src={l.image} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${l.slug}`} className="line-clamp-1 font-semibold hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-[12px] text-[#66707c]">
                      {l.brandName} · Size {l.size}
                    </p>
                  </div>
                  <p className="num whitespace-nowrap text-[#4a525c]">
                    {money(l.unit)} × {l.qty}
                  </p>
                  <p className="num w-20 text-right font-medium">{money(l.total)}</p>
                </li>
              ))}
            </ul>
            <OrderActions id={o.id} fulfillment={o.fulfillment} archived={o.archived} refunded={o.payment === 'refunded'} writable={storeWritable()} />
          </Card>
          <Card title={<span className="flex items-center gap-2"><StatusBadge status={o.payment} /> Payment</span>}>
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-[#4a525c]">Subtotal · {o.items} items</dt>
                <dd className="num">{money(o.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#4a525c]">Shipping</dt>
                <dd className="num">{o.shipping ? money(o.shipping) : 'Free'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#4a525c]">Tax (8%)</dt>
                <dd className="num">{money(o.tax)}</dd>
              </div>
              <div className="adm-sep flex justify-between pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="num">{money(o.total)}</dd>
              </div>
              <div className="flex justify-between text-[#4a525c]">
                <dt>{o.payment === 'paid' ? 'Paid by customer' : o.payment === 'refunded' ? 'Refunded' : 'Awaiting payment'}</dt>
                <dd className="num">{o.payment === 'pending' ? money(0) : money(o.total)}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Timeline">
            <OrderNotes id={o.id} writable={storeWritable()} />
            <ol className="mt-4 space-y-3 border-l-2 border-[#e3e6ea] pl-4">
              {events.map((e, k) => (
                <li key={k} className="relative">
                  <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${e.note ? 'bg-[var(--color-cobalt)]' : 'bg-[#b8bfc8]'}`} />
                  <p className={e.note ? 'whitespace-pre-wrap rounded-lg bg-[#f6f7f9] px-3 py-2' : ''}>{e.text}</p>
                  <p className="mt-0.5 text-[11.5px] text-[#8a939e]">{dateTime(e.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-3">
          <Card title="Customer">
            <p className="font-semibold">{o.customer.name}</p>
            <Link href={`/admin/orders?q=${encodeURIComponent(o.customer.name)}`} className="adm-link text-[12.5px]">
              {history.length} order{history.length === 1 ? '' : 's'}
            </Link>
            <p className="mt-4 text-[12px] font-semibold text-[#66707c]">Contact</p>
            <p className="break-all">{o.customer.email}</p>
            <p className="mt-4 text-[12px] font-semibold text-[#66707c]">Shipping address</p>
            <p>
              {o.customer.name}
              <br />
              {o.customer.city}, {o.customer.country}
            </p>
          </Card>
          <Card title="Sample data">
            <p className="text-[#66707c]">This order is generated so the admin can be tried out. The store’s checkout doesn’t take real orders yet.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
