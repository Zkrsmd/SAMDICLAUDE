'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { formatPrice } from '@/lib/format';
import { goToField } from '@/lib/scroll-to';
import { CheckoutSchema, formatPhone, normalizePhone, splitName, type DeliveryMethod } from '@/lib/validation/order';
import { useT } from '@/i18n/client';
import { lineKey, useCart, type CartLine } from '@/stores/cart';
import { useHydrated } from '@/hooks/useHydrated';
import { useQuote } from '@/hooks/useQuote';
import type { OrderResponse } from '@/app/api/orders/route';
import type { CheckoutWilaya } from './CodCheckout';

type Field = 'name' | 'phone' | 'wilaya' | 'commune' | 'method';
/** top to bottom, the order the customer meets the fields in */
const ORDER: Field[] = ['name', 'phone', 'wilaya', 'commune', 'method'];
/** schema fields → the field on this form */
const FIELD: Record<string, Field> = { firstName: 'name', lastName: 'name', phone: 'phone', wilaya: 'wilaya', commune: 'commune', method: 'method' };
/** the buyer's details, remembered on this device only to save typing next time */
const SAVED = 'revo-buyer';

/**
 * Buy right here: the cash-on-delivery form on the product page, as short as it can be — name,
 * phone, wilaya, commune, home or stop desk (no street address: in Algeria the courier calls).
 * It orders everything in the bag plus this product in the chosen size (so "S" then "M" arrive
 * together), then empties the bag. If something is missing — the size above, or a field here —
 * the page scrolls back to it with the reason in red, and the red goes as soon as it's fixed.
 * Same validation and the same /api/orders as the checkout: the server prices everything again.
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
  /** shows the page's size error and scrolls to the sizes; false when no size is chosen yet */
  ensureSize: () => boolean;
}) {
  const t = useT();
  const confirmCall = t(confirmCallEn);
  const [f, setF] = useState({ name: '', phone: '', wilaya: 0, commune: '' });
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
  const count = items.reduce((n, l) => n + l.qty, 0) || qty;

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

  /** typing fixes a field: its red goes at once */
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    if (errors[k as Field] || errors.form) setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };
  useEffect(() => {
    // the stop desk isn't offered everywhere: fall back to home delivery
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (w && w[method] === null && w[method === 'home' ? 'desk' : 'home'] !== null) setMethod(method === 'home' ? 'desk' : 'home');
  }, [w, method]);

  /** bring the first field to fix back on screen */
  const showFirst = (out: Partial<Record<Field, string>>) => {
    const first = ORDER.find((k) => out[k]);
    if (!first) return;
    const box = document.getElementById(`qb-f-${first}`);
    goToField(box, box?.querySelector<HTMLElement>('input:not([type=hidden]):not(:disabled), select') ?? null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    // ordering from this page means this product too: it needs a size unless it's already in the bag
    const needSize = !size && !(hydrated && bag.some((l) => l.productId === productId));
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
      note: '',
      items: items.map(({ productId, colorId, size, qty }) => ({ productId, colorId, size, qty })),
      website: honey.current?.value ?? '',
    };
    // check the details even while the size is missing, so everything to fix shows at once
    const check = CheckoutSchema.safeParse(items.length ? body : { ...body, items: [{ productId, colorId, size: '-', qty }] });
    const out: Partial<Record<Field, string>> = {};
    if (!check.success)
      for (const i of check.error.issues) {
        const k = FIELD[String(i.path[0])];
        if (k) out[k] ??= k === 'name' ? 'Enter your first and last name' : i.message;
      }
    if (needSize || !check.success) {
      setErrors(out);
      // the size comes first on the page: go there first
      if (needSize) ensureSize();
      else showFirst(out);
      return;
    }
    setSending(true);
    setErrors({});
    try {
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const r = (await res.json().catch(() => ({ ok: false, error: t('Your order could not be sent. Check your connection and try again.') }))) as OrderResponse;
      if (!res.ok || !r.ok) {
        const next: Partial<Record<Field | 'form', string>> = { form: r.error ?? t('Your order could not be sent.') };
        for (const [k, v] of Object.entries(r.fields ?? {})) if (FIELD[k]) next[FIELD[k]] = FIELD[k] === 'name' ? 'Enter your first and last name' : v;
        setErrors(next);
        showFirst(next);
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
      <p className="co-err" id={`qb-${k}-err`} role="alert">
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
      <div className="qb-head">
        <h2 id="qb-title" className="display text-[24px]">
          {t('Order now')}
        </h2>
        <ul className="qb-promise" aria-label={t('Cash on delivery')}>
          <li>{t('Pay in cash on delivery')}</li>
          <li>{t('All 58 wilayas')}</li>
        </ul>
      </div>

      <p className="qb-step">
        <span aria-hidden>1</span>
        {t('Your details')}
      </p>
      <div className="qb-stack">
        <div id="qb-f-name" className="qb-field">
          <label htmlFor="qb-name" className="qb-label">
            {t('Full name')}
          </label>
          <span className="qb-control">
            <Icon name="user" size={18} className="qb-ico" />
            <input id="qb-name" name="name" className="co-input" autoComplete="name" placeholder={t('e.g. Karim Benali')} value={f.name} onChange={(e) => set('name', e.target.value)} {...inv('name')} />
          </span>
          {err('name')}
        </div>
        <div id="qb-f-phone" className="qb-field">
          <label htmlFor="qb-phone" className="qb-label">
            {t('Phone number')}
          </label>
          <span className="qb-control">
            <Icon name="phone" size={18} className="qb-ico" />
            <input
              id="qb-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              className="co-input mono qb-phone"
              autoComplete="tel"
              placeholder="05 55 12 34 56"
              value={f.phone}
              onChange={(e) => set('phone', e.target.value)}
              {...inv('phone')}
            />
          </span>
          {err('phone')}
        </div>
      </div>

      <p className="qb-step">
        <span aria-hidden>2</span>
        {t('Delivery')}
      </p>
      <div className="qb-stack">
        <div className="qb-pair">
          <div id="qb-f-wilaya" className="qb-field">
            <label htmlFor="qb-wilaya" className="qb-label">
              {t('Wilaya')}
            </label>
            <span className="qb-control">
              <Icon name="pin" size={18} className="qb-ico" />
              <select id="qb-wilaya" name="wilaya" className="co-input co-select" value={f.wilaya || ''} onChange={(e) => set('wilaya', Number(e.target.value))} {...inv('wilaya')}>
                <option value="">{t('Choose')}</option>
                {options.map((x) => (
                  <option key={x.code} value={x.code} disabled={x.off}>
                    {String(x.code).padStart(2, '0')} · {x.name} · {x.ar}
                  </option>
                ))}
              </select>
            </span>
            {err('wilaya')}
          </div>
          <div id="qb-f-commune" className="qb-field">
            <label htmlFor="qb-commune" className="qb-label">
              {t('Commune')}
            </label>
            <span className="qb-control">
              <input id="qb-commune" name="commune" className="co-input qb-plain" autoComplete="address-level2" placeholder={t('e.g. Bab Ezzouar')} value={f.commune} onChange={(e) => set('commune', e.target.value)} {...inv('commune')} />
            </span>
            {err('commune')}
          </div>
        </div>

        <fieldset id="qb-f-method" className="qb-field">
          <legend className="qb-label">{t('Delivered by {courier}', { courier })}</legend>
          <div className="qb-ways">
            {(
              [
                ['home', 'home', t('Home delivery'), t('To your door')],
                ['desk', 'store', t('Stop desk'), t('At the office')],
              ] as [DeliveryMethod, 'home' | 'store', string, string][]
            ).map(([id, icon, label, help]) => {
              const price = w ? w[id] : undefined;
              const off = price === null;
              return (
                <label key={id} className="qb-way" data-off={off ? '' : undefined}>
                  <input
                    type="radio"
                    name="method"
                    value={id}
                    checked={method === id}
                    disabled={off}
                    onChange={() => {
                      setMethod(id);
                      if (errors.method) setErrors((e) => ({ ...e, method: undefined }));
                    }}
                    className="sr-only"
                  />
                  <span className="qb-way-ico" aria-hidden>
                    <Icon name={icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold leading-tight">{label}</span>
                    <span className="block text-[12px] text-muted">{off ? t('Not offered in this wilaya') : help}</span>
                  </span>
                  <span className="qb-way-price mono">{price === undefined || off ? '—' : formatPrice(price * 100)}</span>
                </label>
              );
            })}
          </div>
          {err('method')}
        </fieldset>
      </div>

      <div className="co-hp" aria-hidden>
        <label htmlFor="qb-website">Website</label>
        <input ref={honey} id="qb-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="qb-bill">
        {!onlyThis && quote && quote.lines.length > 0 && (
          <div className="qb-lines" data-testid="qb-lines">
            <p className="eyebrow text-muted">
              {t('Your order')} · {count}
            </p>
            <ul>
              {quote.lines.map((l) => (
                <li key={l.key}>
                  <span className="line-clamp-2 min-w-0 flex-1 break-words">
                    <span className="mono text-muted">{l.qty}×</span> {l.name} <span className="text-muted">· {l.size}</span>
                  </span>
                  <span className="mono whitespace-nowrap">{formatPrice(l.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="qb-sum">
          <div>
            <dt>{t('Products')}</dt>
            <dd className="mono">{formatPrice(subtotal)}</dd>
          </div>
          <div>
            <dt>{t('Delivery')}</dt>
            <dd className="mono">{fee !== undefined && fee !== null ? formatPrice(fee * 100) : <span className="font-sans text-[12.5px] text-muted">{t('Choose your wilaya')}</span>}</dd>
          </div>
          <div className="qb-total">
            <dt>{t('Total')}</dt>
            <dd key={total} className="mono qb-pop" data-testid="qb-total">
              {formatPrice(total)}
            </dd>
          </div>
        </dl>
      </div>

      {errors.form && (
        <p className="co-err mt-3" role="alert">
          {t(errors.form)}
        </p>
      )}
      <button type="submit" className="btn-order qb-buy mt-4 h-[58px] w-full" disabled={sending} data-sending={sending ? '' : undefined}>
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
