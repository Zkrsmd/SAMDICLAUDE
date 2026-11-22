'use client';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { ProductImage } from '@/components/product/ProductImage';
import { useCart } from '@/stores/cart';
import { formatPrice } from '@/lib/format';
import type { QuoteResponse } from '@/app/api/cart/quote/route';
import { useT } from '@/i18n/client';

export function CartLines({ quote, compact, failed }: { quote: QuoteResponse | null; compact?: boolean; failed?: boolean }) {
  const t = useT();
  const { setQty, remove, clear } = useCart();
  if (!quote && failed)
    return (
      <div className="py-10 text-center">
        <p className="text-muted">{t('Your saved bag couldn’t be read.')}</p>
        <button type="button" className="btn btn-line mt-4 h-11" onClick={clear}>
          {t('Reset bag')}
        </button>
      </div>
    );
  if (!quote) return <div className="py-10 text-center text-muted">{t('Loading your bag…')}</div>;
  if (!quote.lines.length && !quote.rejected.length)
    return (
      <div className="py-16 text-center">
        <p className="display text-[40px] text-ink/20">{t('Empty')}</p>
        <p className="mt-2 text-muted">{t('Your bag is waiting for its first piece of kit.')}</p>
      </div>
    );
  return (
    <ul className="divide-y divide-line">
      {quote.lines.map((l) => (
        <li key={l.key} className="flex gap-3 py-4 sm:gap-4">
          <Link
            href={`/product/${l.slug}`}
            className={`relative shrink-0 overflow-hidden rounded-[2px] bg-stone ${compact ? 'h-24 w-24' : 'h-24 w-24 sm:h-32 sm:w-32'}`}
          >
            <ProductImage slug={l.slug} colorId={l.colorId} alt={l.name} sizes="128px" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="eyebrow text-muted">{l.brandName}</span>
            <Link href={`/product/${l.slug}`} className="mt-1 text-[15px] font-medium leading-snug hover:text-cobalt">
              {l.name}
            </Link>
            <span className="mt-1 text-[13px] text-muted">
              {l.colorName} · {l.size}
            </span>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-2">
              <div className="flex items-center border border-line" role="group" aria-label={t('Quantity for {name}', { name: l.name })}>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center disabled:opacity-30"
                  aria-label={t('Decrease quantity')}
                  disabled={l.qty <= 1}
                  onClick={() => setQty(l.key, l.qty - 1)}
                >
                  <Icon name="minus" size={16} />
                </button>
                <span className="mono w-8 text-center text-[14px]" aria-live="polite">
                  {l.qty}
                </span>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center disabled:opacity-30"
                  aria-label={t('Increase quantity')}
                  disabled={l.qty >= 5}
                  onClick={() => setQty(l.key, l.qty + 1)}
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
              <span className="mono whitespace-nowrap text-[14px] font-semibold">{formatPrice(l.total)}</span>
            </div>
          </div>
          <button
            type="button"
            className="-me-2 grid h-9 w-9 shrink-0 place-items-center text-muted hover:text-ink"
            aria-label={t('Remove {name}', { name: l.name })}
            onClick={() => remove(l.key)}
          >
            <Icon name="trash" size={18} />
          </button>
        </li>
      ))}
      {quote.rejected.map((r) => (
        <li key={r.key} className="flex items-center justify-between py-4 text-[14px] text-muted">
          <span>{r.reason}</span>
          <button type="button" className="underline" onClick={() => remove(r.key)}>
            {t('Remove')}
          </button>
        </li>
      ))}
    </ul>
  );
}
