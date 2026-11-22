import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CodActions, EditCustomer, OrderActions, OrderNotes } from '@/components/admin/OrderView';
import { getWilayas } from '@/lib/delivery';
import { brand } from '@/config/brand';
import { COURIER } from '@/data/delivery/wilayas';
import { formatPhone } from '@/lib/validation/order';
import { AIcon, Badge, Card, PageHead, StatusBadge, Thumb, dateTime, longDate, money } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin/auth';
import { getOrder, getOrders } from '@/lib/admin/orders';
import { storeWritable } from '@/lib/store/overrides';
import { loadAdminData } from '@/lib/admin/orders';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await loadAdminData();
  const o = getOrder((await params).id);
  return { title: o ? `Order #${o.number}` : 'Order' };
}

export default async function OrderPage({ params }: Props) {
  await loadAdminData();
  await requireAdmin();
  const { id } = await params;
  const o = getOrder(id);
  if (!o) notFound();
  const all = getOrders();
  const i = all.findIndex((x) => x.id === o.id);
  const newer = all[i - 1];
  const older = all[i + 1];
  const history = all.filter((x) => x.customer.id === o.customer.id);
  const cod = o.cod;
  const STEP: Record<string, string> = {
    new: 'Order placed on the website · cash on delivery',
    no_answer: 'Called — no answer',
    confirmed: 'Confirmed with the customer',
    preparing: 'Being prepared',
    shipped: `Handed to ${COURIER}`,
    delivered: `Delivered · ${money(o.total)} collected in cash`,
    returned: 'Returned · stock put back',
    cancelled: 'Cancelled · stock put back',
  };
  const events = [
    ...o.notes.map((n) => ({ at: n.at, text: n.text, note: true })),
    ...(cod
      ? cod.history.map((h) => ({ at: h.at, text: STEP[h.status] ?? h.status, note: false }))
      : [
          { at: o.createdAt, text: `Order placed on ${o.channel}`, note: false },
          ...(o.payment === 'paid' ? [{ at: o.createdAt, text: `Payment of ${money(o.total)} captured`, note: false }] : []),
          ...(o.payment === 'refunded' ? [{ at: o.createdAt, text: `Refunded ${money(o.total)}`, note: false }] : []),
        ]),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="adm-page adm-page-narrow">
      <PageHead
        title={`#${o.number}`}
        back="/admin/orders"
        meta={
          <span className="flex gap-1.5">
            <StatusBadge status={o.payment} />
            {o.archived ? <Badge>Archived</Badge> : <StatusBadge status={cod?.status ?? o.fulfillment} />}
          </span>
        }
      >
        <span className="flex items-center gap-1">
          <a href={`/admin/print/${o.id}`} target="_blank" rel="noopener" className="adm-btn me-1" data-testid="print-receipt">
            <AIcon name="printer" size={15} /> Print receipt
          </a>
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
        {longDate(o.createdAt)} · {cod ? 'Website · cash on delivery' : o.channel}
      </p>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <Card
            title={
              <span className="flex items-center gap-2">
                <StatusBadge status={cod?.status ?? o.fulfillment} /> {o.items} item{o.items === 1 ? '' : 's'}
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
            {cod ? (
              <CodActions id={o.id} status={cod.status} archived={o.archived} writable={storeWritable()} />
            ) : (
              <OrderActions id={o.id} fulfillment={o.fulfillment} archived={o.archived} refunded={o.payment === 'refunded'} writable={storeWritable()} />
            )}
          </Card>
          <Card title={<span className="flex items-center gap-2"><StatusBadge status={o.payment} /> Payment</span>}>
            <dl className="space-y-1.5">
              <div className="flex justify-between">
                <dt className="text-[#4a525c]">Subtotal · {o.items} items</dt>
                <dd className="num">{money(o.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#4a525c]">
                  Delivery · {COURIER}
                  {cod ? `, ${cod.method === 'home' ? 'home' : 'stop desk'}` : ''}
                </dt>
                <dd className="num">{o.shipping ? money(o.shipping) : 'Free'}</dd>
              </div>
              {o.tax > 0 && (
                <div className="flex justify-between">
                  <dt className="text-[#4a525c]">Tax</dt>
                  <dd className="num">{money(o.tax)}</dd>
                </div>
              )}
              <div className="adm-sep flex justify-between pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="num">{money(o.total)}</dd>
              </div>
              <div className="flex justify-between text-[#4a525c]">
                <dt>
                  {o.payment === 'paid'
                    ? cod
                      ? 'Collected in cash'
                      : 'Paid by customer'
                    : o.payment === 'refunded'
                      ? 'Refunded'
                      : o.payment === 'cod'
                        ? 'Cash to collect on delivery'
                        : o.payment === 'void'
                          ? 'Nothing collected'
                          : 'Awaiting payment'}
                </dt>
                <dd className="num">{o.payment === 'pending' || o.payment === 'void' ? money(0) : money(o.total)}</dd>
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
          <Card
            title="Customer"
            action={
              cod ? (
                <EditCustomer
                  id={o.id}
                  writable={storeWritable()}
                  wilayas={getWilayas().map(({ code, name, home, desk }) => ({ code, name, home, desk }))}
                  initial={{ name: o.customer.name, phone: cod.phone, wilaya: cod.wilaya, commune: cod.commune, method: cod.method, note: cod.note }}
                />
              ) : undefined
            }
          >
            <Link href={cod ? `/admin/customers/${encodeURIComponent(o.customer.id)}` : `/admin/orders?q=${encodeURIComponent(o.customer.name)}`} className="font-semibold hover:underline">
              {o.customer.name}
            </Link>
            <p className="text-[12.5px] text-[#66707c]">
              {history.length} order{history.length === 1 ? '' : 's'}
            </p>
            {cod ? (
              <>
                <p className="mt-4 text-[12px] font-semibold text-[#66707c]">Phone</p>
                <p className="num text-[15px] font-semibold">{formatPhone(cod.phone)}</p>
                <p className="mt-1 flex gap-3 text-[12.5px]">
                  <a href={`tel:${cod.phone}`} className="adm-link">
                    Call
                  </a>
                  <a href={`sms:${cod.phone}`} className="adm-link">
                    SMS
                  </a>
                  <a href={`https://wa.me/213${cod.phone.slice(1)}`} target="_blank" rel="noopener noreferrer" className="adm-link">
                    WhatsApp
                  </a>
                </p>
                <p className="mt-3 rounded-lg bg-[#f6f7f9] px-3 py-2 text-[12.5px]" data-testid="confirm-by">
                  {cod.confirm === 'call' ? `Wants a call to confirm (${brand.commerce.confirmCall})` : 'Wants an SMS to confirm'}
                </p>
                <p className="mt-4 text-[12px] font-semibold text-[#66707c]">Deliver to</p>
                <p className="whitespace-pre-wrap">
                  {o.customer.name}
                  <br />
                  {cod.address ? (
                    <>
                      {cod.address}
                      <br />
                    </>
                  ) : null}
                  {cod.commune}
                  <br />
                  {String(cod.wilaya).padStart(2, '0')} · {cod.wilayaName}
                </p>
                <p className="mt-2 text-[12.5px] text-[#4a525c]">{cod.method === 'home' ? `${COURIER} · home delivery` : `${COURIER} · stop desk (pick-up at the office)`}</p>
                {cod.note && (
                  <>
                    <p className="mt-4 text-[12px] font-semibold text-[#66707c]">Customer note</p>
                    <p className="whitespace-pre-wrap">{cod.note}</p>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="mt-4 text-[12px] font-semibold text-[#66707c]">Contact</p>
                <p className="break-all">{o.customer.email}</p>
                <p className="mt-4 text-[12px] font-semibold text-[#66707c]">Shipping address</p>
                <p>
                  {o.customer.name}
                  <br />
                  {o.customer.city}, {o.customer.country}
                </p>
              </>
            )}
          </Card>
          {!cod && (
            <Card title="Sample data">
              <p className="text-[#66707c]">This order is generated so the admin can be tried out. Sample orders disappear once the first real order comes in.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
