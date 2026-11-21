'use client';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCart } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { renderUrl } from '@/lib/format';
import { useT } from '@/i18n/client';

/**
 * The small "+" that puts a product straight into the bag. One size: it adds at once.
 * Several: a compact size sheet opens above it. The product flies to the bag, the + turns
 * into a tick. Prices are never set here — the bag is quoted by the server.
 */
export function QuickAdd({
  slug,
  name,
  colorId,
  sizes,
  soldOut = [],
  availability = 'in',
}: {
  slug: string;
  name: string;
  colorId: string;
  sizes: string[];
  /** sizes that are out of stock: shown, but can't be picked */
  soldOut?: string[];
  /** "soon" (coming soon) and "out" (out of stock) can't be added */
  availability?: 'in' | 'out' | 'soon';
}) {
  const t = useT();
  const none = availability !== 'in' || sizes.every((s) => soldOut.includes(s));
  const add = useCart((s) => s.add);
  const set = useUi((s) => s.set);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const sheetEl = useRef<HTMLDivElement>(null);
  const sheet = useId();
  const many = sizes.length > 1;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector<HTMLButtonElement>('[data-size]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // the sheet opens above the +; on a narrow screen it must never run off either edge
  // (`translate`, so the sheet's own entrance transform still plays)
  useLayoutEffect(() => {
    const el = sheetEl.current;
    if (!open || !el) return;
    el.style.translate = '';
    const r = el.getBoundingClientRect();
    const dx = Math.max(0, 8 - r.left) - Math.max(0, r.right - (window.innerWidth - 8));
    if (dx) el.style.translate = `${dx.toFixed(0)}px 0`;
  }, [open]);

  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), 1800);
    return () => window.clearTimeout(t);
  }, [done]);

  const commit = (size: string) => {
    add({ productId: slug, colorId, size, qty: 1 });
    const r = btn.current?.getBoundingClientRect();
    if (r) set({ flyFrom: { x: r.left + r.width / 2, y: r.top + r.height / 2, src: renderUrl(slug) } });
    setOpen(false);
    setDone(true);
    btn.current?.focus();
  };

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={btn}
        type="button"
        onClick={() => (many ? setOpen((o) => !o) : commit(sizes[0] ?? 'One size'))}
        disabled={none}
        aria-label={none ? (availability === 'soon' ? t('{name} is coming soon', { name }) : t('{name} is out of stock', { name })) : t('Add {name} to bag', { name })}
        aria-expanded={many ? open : undefined}
        aria-controls={many ? sheet : undefined}
        className={`quick-add grid h-11 w-11 place-items-center rounded-full disabled:opacity-35 ${done ? 'is-done' : ''}`}
      >
        <Icon name={done ? 'check' : 'plus'} size={18} className={`transition-transform duration-500 ease-[var(--ease-expo)] ${open ? 'rotate-45' : ''}`} />
      </button>
      {many && open && (
        <div ref={sheetEl} id={sheet} role="group" aria-label={t('Choose a size for {name}', { name })} className="size-sheet absolute bottom-[calc(100%+10px)] end-0 z-20 w-[min(76vw,264px)] p-3">
          <p className="mono px-1 text-[10px] uppercase tracking-[0.16em] text-muted">{t('Select size')}</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {sizes.map((sz) => (
              <button
                key={sz}
                type="button"
                data-size=""
                onClick={() => commit(sz)}
                disabled={soldOut.includes(sz)}
                aria-label={soldOut.includes(sz) ? t('{size}, sold out', { size: sz }) : undefined}
                className="h-10 rounded-full border border-ink/10 bg-white text-[13px] font-medium transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-white focus-visible:border-ink disabled:pointer-events-none disabled:text-ink/30 disabled:line-through"
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      )}
      <span aria-live="polite" className="sr-only">
        {done ? t('{name} added to bag', { name }) : ''}
      </span>
    </div>
  );
}
