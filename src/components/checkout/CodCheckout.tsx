'use client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useCart } from '@/stores/cart';
import { useQuote } from '@/hooks/useQuote';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice } from '@/lib/format';
import { CheckoutSchema, formatPhone, normalizePhone, type ConfirmBy, type DeliveryMethod } from '@/lib/validation/order';
import type { OrderResponse } from '@/app/api/orders/route';

export interface CheckoutWilaya {
  code: number;
  name: string;
  ar: string;
  /** DA, null = not offered */
  home: number | null;
  desk: number | null;
}

type Field = 'firstName' | 'lastName' | 'phone' | 'wilaya' | 'commune' | 'address' | 'method' | 'confirm' | 'note';
const ORDER: Field[] = ['firstName', 'lastName', 'phone', 'wilaya', 'commune', 'address', 'method', 'confirm', 'note'];

/**
 * Cash-on-delivery checkout for Algeria: who you are, where it goes (wilaya → ZR Express home or
 * stop-desk price), how we confirm (a call within the hour, or an SMS). The server prices the order;
 * the totals here are a preview from the same catalogue and delivery list.
 */
export function CodCheckout({ wilayas, courier, confirmCall }: { wilayas: CheckoutWilaya[]; courier: string; confirmCall: string }) {
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const { data, error: quoteError } = useQuote(lines, hydrated);

  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', wilaya: 0, commune: '', address: '', method: 'home' as DeliveryMethod, confirm: 'call' as ConfirmBy, note: '' });
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ number?: number; firstName: string; phone: string; confirm: ConfirmBy; total: number } | null>(null);
  const honey = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const w = wilayas.find((x) => x.code === f.wilaya);
  // a wilaya without stop desk: fall back to home delivery (and the other way round)
  const method: DeliveryMethod = w && w[f.method] === null ? (f.method === 'desk' ? 'home' : 'desk') : f.method;
  const feeDa = w ? w[method] : null;
  const subtotal = data?.subtotal ?? 0;
  const total = subtotal + (feeDa ?? 0) * 100;
  const blocked = !!data?.rejected.length;
  const empty = hydrated && !lines.length;

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k as Field]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const options = useMemo(() => wilayas.map((x) => ({ ...x, off: x.home === null && x.desk === null })), [wilayas]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || blocked || !lines.length) return;
    const body = { ...f, method, items: lines, website: honey.current?.value ?? '' };
    const check = CheckoutSchema.safeParse(body);
    if (!check.success) {
      const out: Partial<Record<Field, string>> = {};
      for (const i of check.error.issues) out[i.path[0] as Field] ??= i.message;
      setErrors(out);
      const first = ORDER.find((k) => out[k]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setSending(true);
    setErrors({});
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const r = (await res.json().catch(() => ({ ok: false, error: 'Your order could not be sent. Check your connection and try again.' }))) as OrderResponse;
      if (!r.ok) {
        setErrors({ ...(r.fields as Partial<Record<Field, string>>), form: r.error ?? 'Your order could not be sent.' });
        return;
      }
      setDone({ number: r.number, firstName: f.firstName.trim(), phone: normalizePhone(f.phone) ?? f.phone, confirm: f.confirm, total });
      clear();
      window.scrollTo({ top: 0 });
    } catch {
      setErrors({ form: 'Your order could not be sent. Check your connection and try again.' });
    } finally {
      setSending(false);
    }
  };

  const err = (k: Field) =>
    errors[k] ? (
      <p id={`co-${k}-err`} className="co-err">
        {errors[k]}
      </p>
    ) : null;
  const inv = (k: Field) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `co-${k}-err` : undefined });

  if (done)
    return (
      <div className="container-x pb-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 96px)' }}>
        <div className="co-done mx-auto max-w-xl text-center" role="status">
          <span className="co-done-mark" aria-hidden>
            ✓
          </span>
          <p className="eyebrow mt-6 text-muted">{done.number ? `Order #${done.number}` : 'Order received'}</p>
          <h1 className="display mt-3 text-[clamp(30px,6.2vw,56px)]">Thank you, {done.firstName}</h1>
          <p className="mx-auto mt-5 max-w-md text-[16px] text-ink-2">
            {done.confirm === 'call' ? (
              <>
                We’ll call you on <b className="whitespace-nowrap">{formatPhone(done.phone)}</b> {confirmCall} to confirm your order.
              </>
            ) : (
              <>
                We’ll send an SMS to <b className="whitespace-nowrap">{formatPhone(done.phone)}</b> to confirm your order.
              </>
            )}
          </p>
          <p className="mt-3 text-[15px] text-muted">
            Then {courier} brings it to you. Pay <b className="mono text-ink">{formatPrice(done.total)}</b> in cash on delivery.
          </p>
          <Link href="/" className="btn btn-ink mt-8 h-12 px-8">
            Keep shopping
          </Link>
        </div>
      </div>
    );

  return (
    <div className="container-x pb-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
      <p className="eyebrow text-muted">Cash on delivery · Algeria</p>
      <h1 className="display mt-2 text-[clamp(30px,6.2vw,64px)]">Checkout</h1>

      {empty ? (
        <p className="mt-8 text-[16px] text-muted">
          Your bag is empty.{' '}
          <Link href="/" className="text-ink underline">
            Continue shopping
          </Link>
        </p>
      ) : (
        <form ref={formRef} onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          <div className="space-y-4">
            <section className="co-card" aria-labelledby="co-you">
              <h2 id="co-you" className="co-h">
                <span className="mono text-muted">01</span> Your details
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-first" className="co-label">
                    First name
                  </label>
                  <input id="co-first" name="firstName" className="co-input" autoComplete="given-name" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} {...inv('firstName')} />
                  {err('firstName')}
                </div>
                <div>
                  <label htmlFor="co-last" className="co-label">
                    Last name
                  </label>
                  <input id="co-last" name="lastName" className="co-input" autoComplete="family-name" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} {...inv('lastName')} />
                  {err('lastName')}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-phone" className="co-label">
                    Phone number
                  </label>
                  <input
                    id="co-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="co-input mono"
                    placeholder="05 55 12 34 56"
                    value={f.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    {...inv('phone')}
                  />
                  {err('phone') ?? <p className="co-help">A mobile we can call or text to confirm your order.</p>}
                </div>
              </div>
            </section>

            <section className="co-card" aria-labelledby="co-where">
              <h2 id="co-where" className="co-h">
                <span className="mono text-muted">02</span> Delivery
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-wilaya" className="co-label">
                    Wilaya
                  </label>
                  <select id="co-wilaya" name="wilaya" className="co-input co-select" value={f.wilaya || ''} onChange={(e) => set('wilaya', Number(e.target.value))} {...inv('wilaya')}>
                    <option value="" disabled>
                      Choose your wilaya
                    </option>
                    {options.map((x) => (
                      <option key={x.code} value={x.code} disabled={x.off}>
                        {String(x.code).padStart(2, '0')} · {x.name} · {x.ar}
                        {x.off ? ' (not served yet)' : ''}
                      </option>
                    ))}
                  </select>
                  {err('wilaya') ?? <p className="co-help">New 2025 wilaya? Choose the one it was part of.</p>}
                </div>
                <div>
                  <label htmlFor="co-commune" className="co-label">
                    Commune
                  </label>
                  <input id="co-commune" name="commune" className="co-input" autoComplete="address-level2" value={f.commune} onChange={(e) => set('commune', e.target.value)} {...inv('commune')} />
                  {err('commune')}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-address" className="co-label">
                    Address
                  </label>
                  <textarea
                    id="co-address"
                    name="address"
                    rows={2}
                    className="co-input co-textarea"
                    autoComplete="street-address"
                    placeholder="Street, building, floor, nearby landmark"
                    value={f.address}
                    onChange={(e) => set('address', e.target.value)}
                    {...inv('address')}
                  />
                  {err('address')}
                </div>
              </div>

              <fieldset className="mt-5">
                <legend className="co-label">Delivered by {courier}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['home', 'Home delivery', 'To your door'],
                      ['desk', 'Stop desk', `Pick it up at the ${courier} office`],
                    ] as const
                  ).map(([id, label, help]) => {
                    const price = w ? w[id] : undefined;
                    const off = price === null;
                    return (
                      <label key={id} className="co-option" data-off={off ? '' : undefined}>
                        <input type="radio" name="method" value={id} checked={method === id} disabled={off} onChange={() => set('method', id)} className="sr-only" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{label}</span>
                          <span className="block text-[13px] text-muted">{off ? 'Not offered in this wilaya' : help}</span>
                        </span>
                        <span className="mono text-[14px] font-semibold">{price === undefined ? '—' : off ? '' : formatPrice(price * 100)}</span>
                      </label>
                    );
                  })}
                </div>
                {err('method')}
              </fieldset>
            </section>

            <section className="co-card" aria-labelledby="co-confirm">
              <h2 id="co-confirm" className="co-h">
                <span className="mono text-muted">03</span> Confirming your order
              </h2>
              <fieldset className="mt-4">
                <legend className="sr-only">How should we confirm your order?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['call', 'Call me', `We call you ${confirmCall}`],
                      ['sms', 'Send me an SMS', 'We text you to confirm'],
                    ] as const
                  ).map(([id, label, help]) => (
                    <label key={id} className="co-option">
                      <input type="radio" name="confirm" value={id} checked={f.confirm === id} onChange={() => set('confirm', id)} className="sr-only" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{label}</span>
                        <span className="block text-[13px] text-muted">{help}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-5">
                <label htmlFor="co-note" className="co-label">
                  Note for us <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea id="co-note" name="note" rows={2} maxLength={300} className="co-input co-textarea" value={f.note} onChange={(e) => set('note', e.target.value)} {...inv('note')} />
                {err('note')}
              </div>
              {/* honeypot: hidden from people and screen readers; bots fill it in */}
              <div aria-hidden className="co-hp">
                <label htmlFor="co-website">Website</label>
                <input ref={honey} id="co-website" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>
            </section>
          </div>

          <aside className="co-card h-fit lg:sticky lg:top-24" aria-labelledby="co-sum">
            <h2 id="co-sum" className="co-h">
              Your order
            </h2>
            {!hydrated || !data ? (
              <p className="mt-4 text-muted">Loading…</p>
            ) : (
              <ul className="mt-3 divide-y divide-line text-[14px]">
                {data.lines.map((l) => (
                  <li key={l.key} className="flex justify-between gap-4 py-2.5">
                    <span className="min-w-0">
                      <span className="mono text-muted">{l.qty}×</span> {l.name} <span className="text-muted">· {l.size}</span>
                    </span>
                    <span className="mono whitespace-nowrap">{formatPrice(l.total)}</span>
                  </li>
                ))}
              </ul>
            )}
            {blocked && (
              <p className="mt-3 rounded-[2px] bg-[#fff4f2] p-3 text-[13px] text-red-700" role="alert">
                Some items can’t be ordered ({data!.rejected.map((r) => r.reason.toLowerCase()).join(', ')}).{' '}
                <Link href="/cart" className="underline">
                  Update your bag
                </Link>
              </p>
            )}
            {quoteError && <p className="mt-3 text-[13px] text-red-700">{quoteError}</p>}
            <dl className="mt-3 space-y-2 border-t border-line pt-3 text-[15px]">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="mono">{data ? formatPrice(subtotal) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>
                  Delivery <span className="text-[13px] text-muted">{w ? `· ${method === 'home' ? 'home' : 'stop desk'}, ${w.name}` : ''}</span>
                </dt>
                <dd className="mono whitespace-nowrap">{feeDa !== null && feeDa !== undefined ? formatPrice(feeDa * 100) : <span className="font-sans text-[13px] text-muted">Choose your wilaya</span>}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[17px] font-semibold">
                <dt>Total</dt>
                <dd className="mono" data-testid="co-total">
                  {data ? formatPrice(total) : '—'}
                </dd>
              </div>
            </dl>
            <div className="co-cod mt-4">
              <p className="font-semibold">Cash on delivery</p>
              <p className="mt-0.5 text-[13px] text-muted">Pay the courier in cash when your order arrives. No card needed.</p>
            </div>
            {errors.form && (
              <p className="mt-4 text-[14px] text-red-700" role="alert">
                {errors.form}
              </p>
            )}
            <button type="submit" className="btn btn-ink mt-5 h-12 w-full" disabled={sending || blocked || !data || !lines.length}>
              {sending ? 'Sending…' : 'Confirm order'}
            </button>
            <p className="mt-3 text-center text-[12px] text-muted">
              {f.confirm === 'call' ? `We’ll call you ${confirmCall} to confirm.` : 'We’ll text you to confirm.'}
            </p>
          </aside>
        </form>
      )}
    </div>
  );
}
