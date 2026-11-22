'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPrice } from '@/lib/format';
import { CheckoutSchema, formatPhone, normalizePhone, splitName, type DeliveryMethod } from '@/lib/validation/order';
import { useT } from '@/i18n/client';
import { lineKey, useCart, type CartLine } from '@/stores/cart';
import { useHydrated } from '@/hooks/useHydrated';
import { useQuote } from '@/hooks/useQuote';
import type { OrderResponse } from '@/app/api/orders/route';
import type { CheckoutWilaya } from './CodCheckout';

type Field = 'name' | 'phone' | 'wilaya' | 'commune' | 'address' | 'method';
const ORDER: Field[] = ['name', 'phone', 'wilaya', 'commune', 'method', 'address'];
/** schema fields → the field on this form */
const FIELD: Record<string, Field> = { firstName: 'name', lastName: 'name', phone: 'phone', wilaya: 'wilaya', commune: 'commune', address: 'address', method: 'method' };
/** the buyer's details, remembered on this device only to save typing next time */
const SAVED = 'revo-buyer';

/**
 * Buy this product right here: the cash-on-delivery form on the product page, kept as short as it can
 * be — name, phone, wilaya, commune, home or stop desk (the address only for home delivery). It orders
 * everything in the bag, plus this product in the chosen size when that isn't in the bag yet (so "S"
 * and "M" added one after the other arrive together), then empties the bag. Same validation and the
 * same /api/orders as the checkout: the server prices everything again. We always confirm by calling.
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
  const [f, setF] = useState({ name: '', phone: '', wilaya: 0, commune: '', address: '' });
  const [method, setMethod] = useState<DeliveryMethod>('home');
  const [errors, setErrors] = useState<Partial<Record<Field | 'form', string>>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ number?: number; receipt?: string; phone: string; total: number } | null>(null);
  const honey = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const hydrated = useHydrated();
  const bag = useCart((s) => s.lines);
  const clearBag = useCart((s) => s.clear);

  /** what this order contains: the bag, plus the current pick if it isn't in the bag already */
  const items = useMemo<CartLine[]>(() => {
    const cur = size ? { productId, colorId, size, qty } : null;
    const lines = hydrated ? bag : [];
    if (!cur) return lines;
    return lines.some((l) => lineKey(l) === lineKey(cur)) ? lines : [...lines, cur];
  }, [bag, hydrated, productId, colorId, size, qty]);
  const { data: quote } = useQuote(items, hydrated && items.length > 0);
  const onlyThis = items.length === 0 || (items.length === 1 && items[0]!.productId === productId && items[0]!.size === size);

  // details remembered on this device
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED);
      if (!raw) return;
      const v = JSON.parse(raw) as Partial<typeof f> & { firstName?: string; lastName?: string; method?: DeliveryMethod };
      const name = v.name ?? [v.firstName, v.lastName].filter(Boolean).join(' ');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setF((x) => ({
        name: name || x.name,
        phone: v.phone ?? x.phone,
        wilaya: typeof v.wilaya === 'number' ? v.wilaya : x.wilaya,
        commune: v.commune ?? x.commune,
        address: v.address ?? x.address,
      }));
      if (v.method === 'home' || v.method === 'desk') setMethod(v.method);
    } catch {
      /* nothing saved */
    }
  }, []);

  const w = wilayas.find((x) => x.code === f.wilaya);
  const fee = w ? w[method] : undefined;
  const subtotal = onlyThis ? unitPrice * qty : (quote?.subtotal ?? unitPrice * qty);
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
    // with an empty bag this product needs a size; with things in the bag, the bag is the order
    if (!items.length) {
      ensureSize();
      return;
    }
    const { firstName, lastName } = splitName(f.name);
    const body = {
      firstName,
      lastName,
      phone: f.phone,
      wilaya: f.wilaya,
      commune: f.commune,
      address: method === 'home' ? f.address : '',
      method,
      confirm: 'call',
      note: '',
      items: items.map(({ productId, colorId, size, qty }) => ({ productId, colorId, size, qty })),
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
        const out: Partial<Record<Field | 'form', string>> = { form: r.error ?? t('Your order could not be sent.') };
        for (const [k, v] of Object.entries(r.fields ?? {})) if (FIELD[k]) out[FIELD[k]] = FIELD[k] === 'name' ? 'Enter your first and last name' : v;
        setErrors(out);
        return;
      }
      try {
        localStorage.setItem(SAVED, JSON.stringify({ ...f, method }));
      } catch {
        /* private mode */
      }
      setDone({ number: r.number, receipt: r.receipt, phone: normalizePhone(f.phone) ?? f.phone, total });
      clearBag();
    } catch {
      setErrors({ form: t('Your order could not be sent. Check your connection and try again.') });
    } finally {
      setSending(false);
    }
  };

  const err = (k: Field) =>
    errors[k] ? (
      <p className="co-err" id={`qb-${k}-err`}>
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
        <p className="mt-2 text-[17px] font-semibold">{t('We’ll call you on {phone} {when} to confirm your order.', { phone: formatPhone(done.phone), when: confirmCall })}</p>
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
      <h2 id="qb-title" className="display text-[24px]">
        {t('Order now')}
      </h2>
      <ul className="qb-promise" aria-label={t('Cash on delivery')}>
        <li>{t('Pay in cash on delivery')}</li>
        <li>{t('All 58 wilayas')}</li>
      </ul>

      <div className="qb-stack">
        <div className="qb-field" style={{ ['--i' as string]: 0 }}>
          <label htmlFor="qb-name" className="co-label">
            {t('Full name')}
          </label>
          <input id="qb-name" name="name" className="co-input" autoComplete="name" placeholder={t('e.g. Karim Benali')} value={f.name} onChange={(e) => set('name', e.target.value)} {...inv('name')} />
          {err('name')}
        </div>
        <div className="qb-field" style={{ ['--i' as string]: 1 }}>
          <label htmlFor="qb-phone" className="co-label">
            {t('Phone number')}
          </label>
          <input
            id="qb-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className="co-input mono qb-phone"
            autoComplete="tel"
            placeholder="05 55 12 34 56"
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
            {...inv('phone')}
          />
          {err('phone')}
        </div>
        <div className="qb-pair">
          <div className="qb-field" style={{ ['--i' as string]: 2 }}>
            <label htmlFor="qb-wilaya" className="co-label">
              {t('Wilaya')}
            </label>
            <select id="qb-wilaya" name="wilaya" className="co-input co-select" value={f.wilaya || ''} onChange={(e) => set('wilaya', Number(e.target.value))} {...inv('wilaya')}>
              <option value="">{t('Choose')}</option>
              {options.map((x) => (
                <option key={x.code} value={x.code} disabled={x.off}>
                  {String(x.code).padStart(2, '0')} · {x.name} · {x.ar}
                </option>
              ))}
            </select>
            {err('wilaya')}
          </div>
          <div className="qb-field" style={{ ['--i' as string]: 3 }}>
            <label htmlFor="qb-commune" className="co-label">
              {t('Commune')}
            </label>
            <input id="qb-commune" name="commune" className="co-input" autoComplete="address-level2" value={f.commune} onChange={(e) => set('commune', e.target.value)} {...inv('commune')} />
            {err('commune')}
          </div>
        </div>

        <fieldset className="qb-field" style={{ ['--i' as string]: 4 }}>
          <legend className="co-label">{t('Delivered by {courier}', { courier })}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['home', t('Home delivery'), t('To your door')],
                ['desk', t('Stop desk'), t('At the office')],
              ] as [DeliveryMethod, string, string][]
            ).map(([id, label, help]) => {
              const price = w ? w[id] : undefined;
              const off = price === null;
              return (
                <label key={id} className="qb-way" data-off={off ? '' : undefined}>
                  <input type="radio" name="method" value={id} checked={method === id} disabled={off} onChange={() => setMethod(id)} className="sr-only" />
                  <span className="block text-[15px] font-semibold">{label}</span>
                  <span className="block text-[12px] text-muted">{off ? t('Not offered in this wilaya') : help}</span>
                  <span className="mono mt-1 block text-[14px] font-semibold">{price === undefined || off ? '—' : formatPrice(price * 100)}</span>
                </label>
              );
            })}
          </div>
          {err('method')}
        </fieldset>

        {method === 'home' && (
          <div className="qb-field" style={{ ['--i' as string]: 5 }}>
            <label htmlFor="qb-address" className="co-label">
              {t('Address')}
            </label>
            <input
              id="qb-address"
              name="address"
              className="co-input"
              autoComplete="street-address"
              placeholder={t('Street, building, floor, nearby landmark')}
              value={f.address}
              onChange={(e) => set('address', e.target.value)}
              {...inv('address')}
            />
            {err('address')}
          </div>
        )}
      </div>

      <div className="co-hp" aria-hidden>
        <label htmlFor="qb-website">Website</label>
        <input ref={honey} id="qb-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {!onlyThis && quote && quote.lines.length > 0 && (
        <div className="qb-lines" data-testid="qb-lines">
          <p className="eyebrow text-muted">
            {t('Your order')} · {items.reduce((n, l) => n + l.qty, 0)}
          </p>
          <ul>
            {quote.lines.map((l) => (
              <li key={l.key}>
                <span className="min-w-0 flex-1 truncate">
                  <span className="mono text-muted">{l.qty}×</span> {l.name} <span className="text-muted">· {l.size}</span>
                </span>
                <span className="mono whitespace-nowrap">{formatPrice(l.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="qb-sum">
        <span className="text-[13px] text-muted">
          {fee !== undefined && fee !== null
            ? t('{product} + {delivery} delivery', { product: formatPrice(subtotal), delivery: formatPrice(fee * 100) })
            : t('Choose your wilaya to see the delivery')}
        </span>
        <span key={total} className="mono qb-pop text-[20px] font-bold" data-testid="qb-total">
          {formatPrice(total)}
        </span>
      </div>

      {errors.form && (
        <p className="co-err mt-3" role="alert">
          {t(errors.form)}
        </p>
      )}
      <button type="submit" className="btn-order qb-buy mt-3 h-[58px] w-full" disabled={sending} data-sending={sending ? '' : undefined}>
        {sending ? (
          <>
            <span className="btn-spin" aria-hidden />
            {t('Sending…')}
          </>
        ) : (
          t('Order now')
        )}
      </button>
      <p className="mt-2.5 text-center text-[12.5px] text-muted">{t('We’ll call you {when} to confirm.', { when: confirmCall })}</p>
    </form>
  );
}
