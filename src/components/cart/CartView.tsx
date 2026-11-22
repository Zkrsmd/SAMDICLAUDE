'use client';
import Link from 'next/link';
import { CartLines } from './CartLines';
import { useCart } from '@/stores/cart';
import { useQuote } from '@/hooks/useQuote';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice } from '@/lib/format';
import { useT } from '@/i18n/client';

export function CartView() {
  const t = useT();
  const hydrated = useHydrated();
  const lines = useCart((s) => s.lines);
  const { data, error, loading } = useQuote(lines, hydrated);
  return (
    <div className="container-x pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 88px)' }}>
      <h1 className="display text-[clamp(40px,9vw,96px)]">{t('Your bag')}</h1>
      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div aria-live="polite" aria-busy={loading}>
          {hydrated ? <CartLines quote={data} failed={!!error} /> : <p className="py-10 text-muted">{t('Loading your bag…')}</p>}
          {error && <p className="py-3 text-red-700">{error}</p>}
        </div>
        <aside className="h-fit rounded-[2px] border border-line bg-white p-5 lg:sticky lg:top-24">
          <h2 className="eyebrow text-muted">{t('Summary')}</h2>
          <dl className="mt-4 space-y-2 text-[15px]">
            <div className="flex justify-between">
              <dt>{t('Subtotal')}</dt>
              <dd className="mono font-semibold">{data ? formatPrice(data.subtotal) : '—'}</dd>
            </div>
            <div className="flex justify-between text-muted">
              <dt>{t('Delivery')}</dt>
              <dd>{t('By wilaya, at checkout')}</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] text-muted">{t('Cash on delivery: you pay the courier when your order arrives.')}</p>
          <Link
            href="/checkout"
            aria-disabled={!lines.length}
            className={`btn btn-ink mt-5 h-12 w-full ${lines.length ? '' : 'pointer-events-none opacity-40'}`}
          >
            {t('Continue to checkout')}
          </Link>
          <Link href="/" className="btn btn-line mt-3 h-12 w-full">
            {t('Keep shopping')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
