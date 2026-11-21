'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ProductImage } from './ProductImage';
import { Icon } from '@/components/ui/Icon';
import { useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { formatPrice } from '@/lib/format';
import { useT } from '@/i18n/client';

export interface BundleItem {
  slug: string;
  name: string;
  brandName: string;
  price: number;
  colorId: string;
  sizes: string[];
}

/** OFTEN BOUGHT TOGETHER — pick sizes, add the set. Totals shown here are list prices; the bag is priced by the server. */
export function Bundle({ items }: { items: BundleItem[] }) {
  const t = useT();
  const add = useCart((s) => s.add);
  const set = useUi((s) => s.set);
  const [picked, setPicked] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.slug, true])));
  const [sizes, setSizes] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.filter((i) => i.sizes.length === 1).map((i) => [i.slug, i.sizes[0]!])),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const chosen = items.filter((i) => picked[i.slug]);
  const total = chosen.reduce((n, i) => n + i.price, 0);
  const addAll = () => {
    const missing = chosen.filter((i) => !sizes[i.slug]);
    if (missing.length) {
      setMsg(t('Choose a size for: {names}', { names: missing.map((m) => m.name).join(', ') }));
      return;
    }
    chosen.forEach((i) => add({ productId: i.slug, colorId: i.colorId, size: sizes[i.slug]!, qty: 1 }));
    setMsg(null);
    set({ cartOpen: true });
  };
  return (
    <div className="rounded-[2px] border border-line bg-white p-4 md:p-6">
      <ul className="grid gap-4 md:grid-cols-3">
        {items.map((i, n) => (
          <li key={i.slug} className="flex gap-3 md:flex-col">
            <label className="relative block h-24 w-24 shrink-0 cursor-pointer bg-stone md:h-40 md:w-full">
              <input
                type="checkbox"
                checked={!!picked[i.slug]}
                onChange={(e) => setPicked((p) => ({ ...p, [i.slug]: e.target.checked }))}
                className="absolute left-2 top-2 z-10 h-5 w-5 accent-[#171A18]"
                aria-label={t('Include {name}', { name: i.name })}
              />
              <ProductImage slug={i.slug} colorId={i.colorId} alt="" sizes="160px" />
              {n > 0 && (
                <span className="absolute -left-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-ink text-white md:grid" aria-hidden>
                  <Icon name="plus" size={14} />
                </span>
              )}
            </label>
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-muted">{i.brandName}</p>
              <Link href={`/product/${i.slug}`} className="text-[14px] font-medium leading-snug hover:text-cobalt">
                {i.name}
              </Link>
              <p className="mono text-[13px]">{formatPrice(i.price)}</p>
              {i.sizes.length > 1 && (
                <select
                  aria-label={t('Size for {name}', { name: i.name })}
                  value={sizes[i.slug] ?? ''}
                  onChange={(e) => setSizes((s) => ({ ...s, [i.slug]: e.target.value }))}
                  className="mt-2 h-10 w-full rounded-[2px] border border-line bg-white px-2 text-[13px]"
                >
                  <option value="">{t('Size')}</option>
                  {i.sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px]">
          {chosen.length} items · <span className="mono font-semibold">{formatPrice(total)}</span>
        </p>
        <button type="button" className="btn btn-ink h-12" onClick={addAll} disabled={!chosen.length}>
          {t('Add selected to bag')}
        </button>
      </div>
      {msg && (
        <p role="alert" className="mt-2 text-[13px] text-red-700">
          {msg}
        </p>
      )}
    </div>
  );
}
