'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '@/lib/format';
import { CheckoutSchema, formatPhone, normalizePhone, type ConfirmBy, type DeliveryMethod } from '@/lib/validation/order';
import { useT } from '@/i18n/client';
import type { OrderResponse } from '@/app/api/orders/route';
import type { CheckoutWilaya } from './CodCheckout';

type Field = 'firstName' | 'lastName' | 'phone' | 'wilaya' | 'commune' | 'address' | 'method' | 'confirm';
const ORDER: Field[] = ['firstName', 'lastName', 'phone', 'wilaya', 'commune', 'address', 'method', 'confirm'];
/** the buyer's details, remembered on this device only to save typing next time */
const SAVED = 'revo-buyer';

/**
 * Buy this product right here: the cash-on-delivery form on the product page (same fields, same
 * validation and the same /api/orders as the checkout — the server prices everything again). One tap
 * on "Buy now" places the order for the chosen size and quantity.
 */
export function QuickBuy({
  productId,
  colorId,
  size,
  qty,
  unitPrice,
  wilayas,
  courier,
  confirmCall: confirmCallEn,
  ensureSize,
}: {
  productId: string;
  colorId: string;
  size: string | null;
  qty: number;
  /** centimes */
  unitPrice: number;
  wilayas: CheckoutWilaya[];
  courier: string;
  confirmCall: string;
  /** asks the page to show its size error; false when no size is chosen yet */
  ensureSize: () => boolean;
}) {
  const t = useT();
  const confirmCall = t(confirmCallEn);
  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', wilaya: 0, commune: '', address: '', confirm: 'call' as ConfirmBy, note: '' });
  const [method, setMethod] = useState<DeliveryMethod>('home');
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ number?: number; receipt?: string; phone: string; confirm: ConfirmBy; total: number } | null>(null);
  const honey = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // details remembered on this device
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED);
      if (!raw) return;
      const v = JSON.parse(raw) as Partial<typeof f> & { method?: DeliveryMethod };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF((x) => ({ ...x, ...v, note: '' }));
      if (v.method === 'home' || v.method === 'desk') setMethod(v.method);
    } catch {
      /* nothing saved */
    }
  }, []);

  const w = wilayas.find((x) => x.code === f.wilaya);
  const fee = w ? w[method] : undefined;
  const subtotal = unitPrice * qty;
  const total = subtotal + (fee ? fee * 100 : 0);
  const options = useMemo(() => wilayas.map((x) => ({ ...x, off: x.home === null && x.desk === null })), [wilayas]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k as Field]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  useEffect(() => {
    // the stop desk isn't offered everywhere: fall back to home delivery
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (w && w[method] === null && w[method === 'home' ? 'desk' : 'home'] !== null) setMethod(method === 'home' ? 'desk' : 'home');
  }, [w, method]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!ensureSize() || !size) return;
    const body = { ...f, method, items: [{ productId, colorId, size, qty }], website: honey.current?.value ?? '' };
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
      const r = (await res.json().catch(() => ({ ok: false, error: t('Your order could not be sent. Check your connection and try again.') }))) as OrderResponse;
      if (!res.ok || !r.ok) {
        setErrors({ ...(r.fields as Partial<Record<Field, string>>), form: r.error ?? t('Your order could not be sent.') });
        return;
      }
      try {
        const { firstName, lastName, phone, wilaya, commune, address, confirm } = f;
        localStorage.setItem(SAVED, JSON.stringify({ firstName, lastName, phone, wilaya, commune, address, confirm, method }));
      } catch {
        /* private mode */
      }
      setDone({ number: r.number, receipt: r.receipt, phone: normalizePhone(f.phone) ?? f.phone, confirm: f.confirm, total });
    } catch {
      setErrors({ form: t('Your order could not be sent. Check your connection and try again.') });
    } finally {
      setSending(false);
    }
  };

  const err = (k: Field) =>
    errors[k] ? (
      <p className="co-error" id={`qb-${k}-err`}>
        {t(errors[k] ?? '')}
      </p>
    ) : null;
  const inv = (k: Field) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `qb-${k}-err` : undefined });

  if (done)
    return (
      <div className="qb qb-done" role="status" data-testid="quickbuy-done">
        <span className="co-done-mark" aria-hidden>
          ✓
        </span>
        <p className="eyebrow mt-4 text-muted">{done.number ? t('Order #{n}', { n: done.number }) : t('Order received')}</p>
        <p className="mt-2 text-[16px] font-semibold">
          {done.confirm === 'call'
            ? t('We’ll call you on {phone} {when} to confirm your order.', { phone: formatPhone(done.phone), when: confirmCall })
            : t('We’ll send an SMS to {phone} to confirm your order.', { phone: formatPhone(done.phone) })}
        </p>
        <p className="mt-2 text-[14px] text-muted">{t('Then {courier} brings it to you. Pay {total} in cash on delivery.', { courier, total: formatPrice(done.total) })}</p>
        {done.receipt && (
          <Link href={done.receipt} className="btn btn-line mt-4 h-11 px-6">
            {t('View receipt')}
          </Link>
        )}
      </div>
    );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="qb" aria-labelledby="qb-title" data-testid="quickbuy">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="qb-title" className="display text-[22px]">
          {t('Order in 30 seconds')}
        </h2>
        <span className="eyebrow text-muted">{t('Cash on delivery')}</span>
      </div>
      <p className="mt-1 text-[13px] text-muted">{t('Fill in your details and order now — you pay in cash when it arrives.')}</p>

      <div className="qb-grid mt-4">
        <div className="qb-field" style={{ ['--i' as string]: 0 }}>
          <label htmlFor="qb-first" className="co-label">
            {t('First name')}
          </label>
          <input id="qb-first" name="firstName" className="co-input" autoComplete="given-name" value={f.firstName} onChange={(e) => set('firstName', e.target.value)} {...inv('firstName')} />
          {err('firstName')}
        </div>
        <div className="qb-field" style={{ ['--i' as string]: 1 }}>
          <label htmlFor="qb-last" className="co-label">
            {t('Last name')}
          </label>
          <input id="qb-last" name="lastName" className="co-input" autoComplete="family-name" value={f.lastName} onChange={(e) => set('lastName', e.target.value)} {...inv('lastName')} />
          {err('lastName')}
        </div>
        <div className="qb-field qb-wide" style={{ ['--i' as string]: 2 }}>
          <label htmlFor="qb-phone" className="co-label">
            {t('Phone number')}
          </label>
          <input id="qb-phone" name="phone" type="tel" inputMode="tel" className="co-input" autoComplete="tel" placeholder="05 55 12 34 56" value={f.phone} onChange={(e) => set('phone', e.target.value)} {...inv('phone')} />
          {err('phone')}
        </div>
        <div className="qb-field qb-wide" style={{ ['--i' as string]: 3 }}>
          <label htmlFor="qb-wilaya" className="co-label">
            {t('Wilaya')}
          </label>
          <select id="qb-wilaya" name="wilaya" className="co-input co-select" value={f.wilaya || ''} onChange={(e) => set('wilaya', Number(e.target.value))} {...inv('wilaya')}>
            <option value="">{t('Choose your wilaya')}</option>
            {options.map((x) => (
              <option key={x.code} value={x.code} disabled={x.off}>
                {String(x.code).padStart(2, '0')} · {x.name} · {x.ar}
              </option>
            ))}
          </select>
          {err('wilaya')}
        </div>
        <div className="qb-field qb-wide" style={{ ['--i' as string]: 4 }}>
          <label htmlFor="qb-commune" className="co-label">
            {t('Commune')}
          </label>
          <input id="qb-commune" name="commune" className="co-input" autoComplete="address-level2" value={f.commune} onChange={(e) => set('commune', e.target.value)} {...inv('commune')} />
          {err('commune')}
        </div>
        <div className="qb-field qb-wide" style={{ ['--i' as string]: 5 }}>
          <label htmlFor="qb-address" className="co-label">
            {t('Address')}
          </label>
          <input id="qb-address" name="address" className="co-input" autoComplete="street-address" placeholder={t('Street, building, floor, nearby landmark')} value={f.address} onChange={(e) => set('address', e.target.value)} {...inv('address')} />
          {err('address')}
        </div>
      </div>

      <fieldset className="qb-field mt-3" style={{ ['--i' as string]: 6 }}>
        <legend className="co-label">{t('Delivered by {courier}', { courier })}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ['home', t('Home delivery')],
              ['desk', t('Stop desk')],
            ] as [DeliveryMethod, string][]
          ).map(([id, label]) => {
            const price = w ? w[id] : undefined;
            const off = price === null;
            return (
              <label key={id} className="co-option qb-option" data-off={off ? '' : undefined}>
                <input type="radio" name="method" value={id} checked={method === id} disabled={off} onChange={() => setMethod(id)} className="sr-only" />
                <span className="block text-[14px] font-semibold">{label}</span>
                <span className="mono block text-[12px] text-muted">{price === undefined ? '—' : off ? t('Not offered in this wilaya') : formatPrice(price * 100)}</span>
              </label>
            );
          })}
        </div>
        {err('method')}
      </fieldset>

      <fieldset className="qb-field mt-3" style={{ ['--i' as string]: 7 }}>
        <legend className="co-label">{t('How should we confirm your order?')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ['call', t('Call me')],
              ['sms', t('Send me an SMS')],
            ] as [ConfirmBy, string][]
          ).map(([id, label]) => (
            <label key={id} className="chip qb-chip h-10 cursor-pointer px-4 text-[13px]" data-active={f.confirm === id}>
              <input type="radio" name="confirm" value={id} checked={f.confirm === id} onChange={() => set('confirm', id)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="co-hp" aria-hidden>
        <label htmlFor="qb-website">Website</label>
        <input ref={honey} id="qb-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <dl className="qb-total mt-4">
        <div>
          <dt>{t('Subtotal')}</dt>
          <dd className="mono">{formatPrice(subtotal)}</dd>
        </div>
        <div>
          <dt>{t('Delivery')}</dt>
          <dd className="mono">{fee !== undefined && fee !== null ? formatPrice(fee * 100) : <span className="font-sans text-[12px] text-muted">{t('Choose your wilaya')}</span>}</dd>
        </div>
        <div className="qb-total-row">
          <dt>{t('Total')}</dt>
          <dd key={total} className="mono qb-pop" data-testid="qb-total">
            {formatPrice(total)}
          </dd>
        </div>
      </dl>

      {errors.form && (
        <p className="co-error mt-3" role="alert">
          {t(errors.form)}
        </p>
      )}
      <button type="submit" className="btn btn-ink qb-buy mt-4 h-14 w-full rounded-full text-[16px]" disabled={sending}>
        {sending ? t('Sending…') : t('Buy now')}
      </button>
      <p className="mt-2 text-center text-[12px] text-muted">
        {f.confirm === 'call' ? t('We’ll call you {when} to confirm.', { when: confirmCall }) : t('We’ll text you to confirm.')}
      </p>
    </form>
  );
}
