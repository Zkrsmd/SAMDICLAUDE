'use client';
import Link from 'next/link';
import { useCart } from '@/stores/cart';
import { useQuote } from '@/hooks/useQuote';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice } from '@/lib/format';

/**
 * Demonstration checkout. There is deliberately no payment form, no card handling and no
 * order confirmation: a real payment provider must be integrated server-side first (see SECURITY.md).
 */
export function DemoCheckout() {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const { data, error } = useQuote(lines, hydrated);
  return (
    <div className="container-x pb-16" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
      <div role="note" className="rounded-[2px] border-2 border-ink bg-white p-5">
        <p className="eyebrow">Demonstration checkout</p>
        <p className="mt-2 text-[16px] font-medium">No payment is taken and no order is placed.</p>
        <p className="mt-1 text-[14px] text-muted">
          This store is a prototype. Payments, delivery options and stock confirmation will be enabled once a real payment provider and
          fulfilment system are integrated.
        </p>
      </div>
      <h1 className="display mt-10 text-[clamp(52px,15vw,150px)]">Checkout</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <ol className="space-y-4">
          {['Contact', 'Delivery', 'Payment'].map((step, i) => (
            <li key={step} className="rounded-[2px] border border-dashed border-line p-5">
              <p className="eyebrow text-muted">
                Step {i + 1} · {step}
              </p>
              <p className="mt-2 text-[14px] text-muted">
                {step === 'Payment'
                  ? 'Payment will be handled by a certified provider (e.g. hosted fields). Card details will never touch this application.'
                  : `${step} details form — placeholder until the order flow is connected to a backend.`}
              </p>
            </li>
          ))}
        </ol>
        <aside className="h-fit rounded-[2px] border border-line bg-white p-5">
          <h2 className="eyebrow text-muted">Order summary</h2>
          {!hydrated || !data ? (
            <p className="mt-4 text-muted">Loading…</p>
          ) : data.lines.length ? (
            <ul className="mt-4 divide-y divide-line text-[14px]">
              {data.lines.map((l) => (
                <li key={l.key} className="flex justify-between gap-4 py-2">
                  <span>
                    {l.qty} × {l.name} <span className="text-muted">({l.colorName}, {l.size})</span>
                  </span>
                  <span className="mono">{formatPrice(l.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-muted">
              Your bag is empty. <Link href="/" className="underline">Continue shopping</Link>
            </p>
          )}
          {error && <p className="mt-3 text-red-700">{error}</p>}
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-[15px]">
            <span>Subtotal</span>
            <span className="mono font-semibold">{data ? formatPrice(data.subtotal) : '—'}</span>
          </div>
          <button type="button" disabled className="btn btn-ink mt-5 h-12 w-full cursor-not-allowed opacity-40" aria-describedby="demo-note">
            Place order (disabled in demo)
          </button>
          <p id="demo-note" className="mt-2 text-[12px] text-muted">
            Ordering is disabled until a payment provider is integrated.
          </p>
        </aside>
      </div>
    </div>
  );
}
