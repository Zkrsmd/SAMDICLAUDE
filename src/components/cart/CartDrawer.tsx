'use client';
import Link from 'next/link';
import { useCallback, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { useDialog } from '@/hooks/useDialog';
import { useQuote } from '@/hooks/useQuote';
import { CartLines } from './CartLines';
import { formatPrice } from '@/lib/format';
import { useT } from '@/i18n/client';

export function CartDrawer() {
  const t = useT();
  const open = useUi((s) => s.cartOpen);
  const set = useUi((s) => s.set);
  const lines = useCart((s) => s.lines);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => set({ cartOpen: false }), [set]);
  useDialog(ref, open, close);
  const { data, error, loading } = useQuote(lines, open);

  return (
    <div aria-hidden={!open} inert={!open} className={`fixed inset-0 z-[70] ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={close}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t('Your bag')}
        className={`absolute bottom-0 right-0 top-0 flex w-full max-w-[440px] flex-col bg-bg shadow-2xl transition-transform duration-700 ease-[var(--ease-expo)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16 items-center border-b border-line px-5">
          <h2 className="display text-[32px]">{t('Your bag')}</h2>
          <button type="button" className="-me-2 ms-auto grid h-11 w-11 place-items-center" aria-label={t('Close bag')} onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5" aria-live="polite" aria-busy={loading}>
          <CartLines quote={data} compact failed={!!error} />
          {error && <p className="py-4 text-[14px] text-red-700">{error}</p>}
        </div>
        <div className="border-t border-line p-5">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow text-muted">{t('Subtotal')}</span>
            <span className="mono text-[18px] font-semibold">{data ? formatPrice(data.subtotal) : '—'}</span>
          </div>
          <p className="mt-1 text-[12px] text-muted">{t('Delivery priced by wilaya at checkout · cash on delivery.')}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/cart" className="btn btn-line" onClick={close}>
              {t('View bag')}
            </Link>
            <Link
              href="/checkout"
              className={`btn btn-ink ${lines.length ? '' : 'pointer-events-none opacity-40'}`}
              aria-disabled={!lines.length}
              onClick={close}
            >
              {t('Checkout')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
