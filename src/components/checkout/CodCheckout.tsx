'use client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useCart } from '@/stores/cart';
import { useQuote } from '@/hooks/useQuote';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice } from '@/lib/format';
import { CheckoutSchema, formatPhone, normalizePhone, splitName, type DeliveryMethod } from '@/lib/validation/order';
import { goToField } from '@/lib/scroll-to';
import { useT } from '@/i18n/client';
import type { OrderResponse } from '@/app/api/orders/route';

export interface CheckoutWilaya {
  code: number;
  name: string;
  ar: string;
  /** DA, null = not offered */
  home: number | null;
  desk: number | null;
}

type Field = 'name' | 'phone' | 'wilaya' | 'commune' | 'method' | 'note';
const ORDER: Field[] = ['name', 'phone', 'wilaya', 'commune', 'method', 'note'];
/** schema fields → the field on this form */
const FIELD: Record<string, Field> = { firstName: 'name', lastName: 'name', phone: 'phone', wilaya: 'wilaya', commune: 'commune', method: 'method', note: 'note' };

/**
 * Cash-on-delivery checkout for Algeria: who you are, where it goes (wilaya → ZR Express home or
 * stop-desk price; no street address — the courier calls). We confirm every order by calling. The server prices the order;
 * the totals here are a preview from the same catalogue and delivery list.
 */
export function CodCheckout({ wilayas, courier, confirmCall: confirmCallEn }: { wilayas: CheckoutWilaya[]; courier: string; confirmCall: string }) {
  const t = useT();
  const confirmCall = t(confirmCallEn);
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const { data, error: quoteError } = useQuote(lines, hydrated);

  const [f, setF] = useState({ name: '', phone: '', wilaya: 0, commune: '', method: 'home' as DeliveryMethod, note: '' });
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ number?: number; receipt?: string; firstName: string; phone: string; total: number } | null>(null);
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

  /** bring the first field to fix back on screen, with its reason in red */
  const showFirst = (out: Partial<Record<Field | 'form', string>>) => {
    const first = ORDER.find((k) => out[k]);
    const el = first ? formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`) : null;
    if (el) goToField(el.closest<HTMLElement>('[data-field]') ?? el, el);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || blocked || !lines.length) return;
    const { firstName, lastName } = splitName(f.name);
    const body = {
      firstName,
      lastName,
      phone: f.phone,
      wilaya: f.wilaya,
      commune: f.commune,
      address: '',
      method,
      confirm: 'call',
      note: f.note,
      items: lines,
      website: honey.current?.value ?? '',
    };
    const check = CheckoutSchema.safeParse(body);
    if (!check.success) {
      const out: Partial<Record<Field, string>> = {};
      for (const i of check.error.issues) {
        const k = FIELD[String(i.path[0])];
        if (k) out[k] ??= k === 'name' ? 'Enter your first and last name' : i.message;
      }
      setErrors(out);
      showFirst(out);
      return;
    }
    setSending(true);
    setErrors({});
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const r = (await res.json().catch(() => ({ ok: false, error: t('Your order could not be sent. Check your connection and try again.') }))) as OrderResponse;
      if (!r.ok) {
        const out: Partial<Record<Field | 'form', string>> = { form: r.error ?? t('Your order could not be sent.') };
        for (const [k, v] of Object.entries(r.fields ?? {})) if (FIELD[k]) out[FIELD[k]] = FIELD[k] === 'name' ? 'Enter your first and last name' : v;
        setErrors(out);
        showFirst(out);
        return;
      }
      setDone({ number: r.number, receipt: r.receipt, firstName, phone: normalizePhone(f.phone) ?? f.phone, total });
      clear();
      window.scrollTo({ top: 0 });
    } catch {
      setErrors({ form: t('Your order could not be sent. Check your connection and try again.') });
    } finally {
      setSending(false);
    }
  };

  const err = (k: Field) =>
    errors[k] ? (
      <p id={`co-${k}-err`} className="co-err">
        {t(errors[k] ?? '')}
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
          <p className="eyebrow mt-6 text-muted">{done.number ? t('Order #{n}', { n: done.number }) : t('Order received')}</p>
          <h1 className="display mt-3 text-[clamp(30px,6.2vw,56px)]">{t('Thank you, {name}', { name: done.firstName })}</h1>
          <p className="mx-auto mt-5 max-w-md text-[16px] text-ink-2">
            {t('We’ll call you on {phone} {when} to confirm your order.', { phone: formatPhone(done.phone), when: confirmCall })}
          </p>
          <p className="mt-3 text-[15px] text-muted">
            {t('Then {courier} brings it to you. Pay {total} in cash on delivery.', { courier, total: formatPrice(done.total) })}
          </p>
          {done.receipt && (
            <p className="mt-6 text-[14px] text-muted">
              {t('Your receipt and order status:')}{' '}
              <Link href={done.receipt} className="text-ink underline" data-testid="receipt-link">
                {t('open your receipt')}
              </Link>{' '}
              {t('— keep this link, it is private to you.')}
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {done.receipt && (
              <Link href={done.receipt} className="btn h-12 px-8">
                {t('View receipt')}
              </Link>
            )}
            <Link href="/" className="btn btn-ink h-12 px-8">
              {t('Keep shopping')}
            </Link>
          </div>
        </div>
      </div>
    );

  return (
    <div className="container-x pb-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
      <p className="eyebrow text-muted">{t('Cash on delivery · Algeria')}</p>
      <h1 className="display mt-2 text-[clamp(30px,6.2vw,64px)]">{t('Checkout')}</h1>

      {empty ? (
        <p className="mt-8 text-[16px] text-muted">
          {t('Your bag is empty.')}{' '}
          <Link href="/" className="text-ink underline">
            {t('Continue shopping')}
          </Link>
        </p>
      ) : (
        <form ref={formRef} onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          <div className="space-y-4">
            <section className="co-card" aria-labelledby="co-you">
              <h2 id="co-you" className="co-h">
                <span className="mono text-muted">01</span> {t('Your details')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="co-name" className="co-label">
                    {t('Full name')}
                  </label>
                  <input id="co-name" name="name" className="co-input" autoComplete="name" placeholder={t('e.g. Karim Benali')} value={f.name} onChange={(e) => set('name', e.target.value)} {...inv('name')} />
                  {err('name')}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-phone" className="co-label">
                    {t('Phone number')}
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
                  {err('phone') ?? <p className="co-help">{t('We call this number to confirm your order.')}</p>}
                </div>
              </div>
            </section>

            <section className="co-card" aria-labelledby="co-where">
              <h2 id="co-where" className="co-h">
                <span className="mono text-muted">02</span> {t('Delivery')}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-wilaya" className="co-label">
                    {t('Wilaya')}
                  </label>
                  <select id="co-wilaya" name="wilaya" className="co-input co-select" value={f.wilaya || ''} onChange={(e) => set('wilaya', Number(e.target.value))} {...inv('wilaya')}>
                    <option value="" disabled>
                      {t('Choose your wilaya')}
                    </option>
                    {options.map((x) => (
                      <option key={x.code} value={x.code} disabled={x.off}>
                        {String(x.code).padStart(2, '0')} · {x.name} · {x.ar}
                        {x.off ? ' (not served yet)' : ''}
                      </option>
                    ))}
                  </select>
                  {err('wilaya') ?? <p className="co-help">{t('New 2025 wilaya? Choose the one it was part of.')}</p>}
                </div>
                <div>
                  <label htmlFor="co-commune" className="co-label">
                    {t('Commune')}
                  </label>
                  <input id="co-commune" name="commune" className="co-input" autoComplete="address-level2" value={f.commune} onChange={(e) => set('commune', e.target.value)} {...inv('commune')} />
                  {err('commune')}
                </div>
              </div>

              <fieldset className="mt-5">
                <legend className="co-label">{t('Delivered by {courier}', { courier })}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['home', t('Home delivery'), t('To your door')],
                      ['desk', t('Stop desk'), t('Pick it up at the {courier} office', { courier })],
                    ] as const
                  ).map(([id, label, help]) => {
                    const price = w ? w[id] : undefined;
                    const off = price === null;
                    return (
                      <label key={id} className="co-option" data-off={off ? '' : undefined}>
                        <input type="radio" name="method" value={id} checked={method === id} disabled={off} onChange={() => set('method', id)} className="sr-only" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{label}</span>
                          <span className="block text-[13px] text-muted">{off ? t('Not offered in this wilaya') : help}</span>
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
                <span className="mono text-muted">03</span> {t('Confirming your order')}
              </h2>
              <p className="mt-3 text-[15px]">{t('We call you {when}', { when: confirmCall })}</p>
              <div className="mt-5">
                <label htmlFor="co-note" className="co-label">
                  {t('Note for us')} <span className="font-normal text-muted">{t('(optional)')}</span>
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
              {t('Your order')}
            </h2>
            {!hydrated || !data ? (
              <p className="mt-4 text-muted">{t('Loading…')}</p>
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
                {t('Some items can’t be ordered ({list}).', { list: data!.rejected.map((r) => t(r.reason).toLowerCase()).join(', ') })}{' '}
                <Link href="/cart" className="underline">
                  {t('Update your bag')}
                </Link>
              </p>
            )}
            {quoteError && <p className="mt-3 text-[13px] text-red-700">{quoteError}</p>}
            <dl className="mt-3 space-y-2 border-t border-line pt-3 text-[15px]">
              <div className="flex justify-between">
                <dt>{t('Subtotal')}</dt>
                <dd className="mono">{data ? formatPrice(subtotal) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>
                  {t('Delivery')} <span className="text-[13px] text-muted">{w ? `· ${method === 'home' ? t('home') : t('stop desk')}, ${w.name}` : ''}</span>
                </dt>
                <dd className="mono whitespace-nowrap">{feeDa !== null && feeDa !== undefined ? formatPrice(feeDa * 100) : <span className="font-sans text-[13px] text-muted">{t('Choose your wilaya')}</span>}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-[17px] font-semibold">
                <dt>{t('Total')}</dt>
                <dd className="mono" data-testid="co-total">
                  {data ? formatPrice(total) : '—'}
                </dd>
              </div>
            </dl>
            <div className="co-cod mt-4">
              <p className="font-semibold">{t('Cash on delivery')}</p>
              <p className="mt-0.5 text-[13px] text-muted">{t('Pay the courier in cash when your order arrives. No card needed.')}</p>
            </div>
            {errors.form && (
              <p className="mt-4 text-[14px] text-red-700" role="alert">
                {errors.form}
              </p>
            )}
            <button type="submit" className="btn-order qb-buy mt-5 h-14 w-full" disabled={sending || blocked || !data || !lines.length} data-sending={sending ? '' : undefined}>
              {sending ? (
                <>
                  <span className="btn-spin" aria-hidden />
                  {t('Sending…')}
                </>
              ) : (
                t('Confirm order')
              )}
            </button>
            <p className="mt-3 text-center text-[12px] text-muted">
              {t('We’ll call you {when} to confirm.', { when: confirmCall })}
            </p>
          </aside>
        </form>
      )}
    </div>
  );
}
