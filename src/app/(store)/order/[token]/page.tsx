import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COURIER, wilayaName } from '@/data/delivery/wilayas';
import { formatPrice } from '@/lib/format';
import { getOrderByReceipt, type CodStatus } from '@/lib/store/orders';
import { softRateLimit, clientKey } from '@/lib/security/rateLimit';
import { headers } from 'next/headers';
import { getT } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/**
 * A customer's own receipt. Reachable only through the private link they got when ordering
 * (256-bit token; the database stores its hash). Not indexed, not cached, no referrer sent on.
 * The phone number is masked: the link may be forwarded, the full number isn't needed here.
 */
export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };

const STEPS: { status: CodStatus; label: string }[] = [
  { status: 'new', label: 'Received' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'shipped', label: 'With the courier' },
  { status: 'delivered', label: 'Delivered' },
];
const LABEL: Record<CodStatus, string> = {
  new: 'Received — we’ll contact you to confirm',
  confirmed: 'Confirmed — being prepared',
  shipped: `With ${COURIER}`,
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

const mask = (phone: string) => (phone.length >= 10 ? `${phone.slice(0, 2)}•• •• •• ${phone.slice(-2)}` : '••');
const dateFmt = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
};

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const t = await getT();
  // guessing links is pointless (2^256), but don't let anyone hammer the database trying
  if (!softRateLimit(`receipt:${clientKey(await headers())}`, 30).ok) notFound();
  const order = await getOrderByReceipt((await params).token);
  if (!order) notFound();
  const at = STEPS.findIndex((s) => s.status === order.status);
  const stopped = order.status === 'cancelled' || order.status === 'returned';

  return (
    <div className="container-x pb-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
      <p className="eyebrow text-muted">{t('Order #{n}', { n: order.number })} · <span className="mono">{dateFmt(order.createdAt)}</span></p>
      <h1 className="display mt-2 text-[clamp(30px,6.2vw,56px)]">{t('Your receipt')}</h1>
      <p className="mt-3 text-[16px]" data-testid="receipt-status">
        {t(LABEL[order.status])}
      </p>

      {!stopped && (
        <ol className="mt-6 grid grid-cols-4 gap-2 text-[12px]" aria-label={t('Order progress')}>
          {STEPS.map((s, i) => (
            <li key={s.status} className={`border-t-4 pt-2 ${i <= at ? 'border-[#2B59FF] text-ink' : 'border-[#E8EBEF] text-muted'}`} aria-current={i === at ? 'step' : undefined}>
              {t(s.label)}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="items-title">
          <h2 id="items-title" className="eyebrow text-muted">
            {t('Items')}
          </h2>
          <ul className="mt-3 divide-y divide-[#E8EBEF]">
            {order.lines.map((l) => (
              <li key={`${l.slug}-${l.size}`} className="flex items-center gap-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.image} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-lg bg-[#F3F4F6] object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{l.name}</p>
                  <p className="text-[13px] text-muted">
                    {l.size} · × {l.qty}
                  </p>
                </div>
                <p className="mono whitespace-nowrap">{formatPrice(l.total)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1 text-[15px]">
            <dt className="text-muted">{t('Subtotal')}</dt>
            <dd className="mono text-right">{formatPrice(order.subtotal)}</dd>
            <dt className="text-muted">{t('Delivery')} ({order.method === 'desk' ? t('stop desk') : t('home')})</dt>
            <dd className="mono text-right">{formatPrice(order.delivery)}</dd>
            <dt className="font-semibold">{t('To pay in cash on delivery')}</dt>
            <dd className="mono text-right font-semibold" data-testid="receipt-total">
              {formatPrice(order.total)}
            </dd>
          </dl>
        </section>
        <section aria-labelledby="to-title">
          <h2 id="to-title" className="eyebrow text-muted">
            {t('Delivery')}
          </h2>
          <p className="mt-3">
            {order.firstName} {order.lastName.slice(0, 1)}.
            <br />
            {order.commune}, {wilayaName(order.wilaya)}
            <br />
            {order.method === 'desk' ? t('{courier} stop desk', { courier: COURIER }) : t('{courier} home delivery', { courier: COURIER })}
            <br />
            <span className="text-muted">{t('Phone')} <span className="mono">{mask(order.phone)}</span></span>
          </p>
          <p className="mt-6 text-[13px] text-muted">{t('This page is private: anyone with its link can see it, so only share it with people you trust.')}</p>
          <Link href="/" className="btn btn-ink mt-6 h-12 px-8">
            {t('Keep shopping')}
          </Link>
        </section>
      </div>
    </div>
  );
}
