'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ProductImage } from '@/components/product/ProductImage';
import { useUi } from '@/stores/ui';
import { useDialog } from '@/hooks/useDialog';
import { formatPrice } from '@/lib/format';
import type { SearchIndexEntry } from '@/lib/catalog';

const SUGGESTIONS = ['F50', 'Venum gloves', 'mirror goggles', 'shin guards', 'Fastskin cap', 'hand wraps'];

export function SearchOverlay({ index }: { index: SearchIndexEntry[] }) {
  const open = useUi((s) => s.searchOpen);
  const set = useUi((s) => s.set);
  const router = useRouter();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => set({ searchOpen: false }), [set]);
  useDialog(ref, open, close);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return index.filter((e) => terms.every((t) => e.terms.includes(t))).slice(0, 8);
  }, [q, index]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim().slice(0, 80);
    if (!term) return;
    close();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <div aria-hidden={!open} inert={!open} className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-ink/25 backdrop-blur-sm transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={close} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className={`absolute inset-x-0 top-0 max-h-[100svh] overflow-y-auto bg-bg transition-transform duration-700 ease-[var(--ease-expo)] ${
          open ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container-x py-4">
          <form onSubmit={submit} role="search" className="flex items-center gap-3 border-b-2 border-ink">
            <Icon name="search" size={26} />
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <input
              id="site-search"
              data-autofocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search boots, gloves, goggles…"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={80}
              className="display h-16 flex-1 bg-transparent text-[clamp(30px,8vw,56px)] outline-none placeholder:text-ink/20"
            />
            <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Close search" onClick={close}>
              <Icon name="close" />
            </button>
          </form>

          {!q && (
            <div className="py-6">
              <p className="eyebrow text-muted">Popular</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => setQ(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {q && (
            <div className="py-4" aria-live="polite">
              <p className="eyebrow text-muted">{results.length ? `${results.length} matches` : 'No instant matches — press enter to search everything'}</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {results.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/product/${r.slug}`} onClick={close} className="flex items-center gap-4 rounded-[2px] p-2 hover:bg-stone">
                      <span className="relative h-16 w-16 shrink-0 bg-stone">
                        <ProductImage slug={r.slug} colorId={r.colorId} alt="" sizes="64px" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="eyebrow block text-muted">{r.brandName}</span>
                        <span className="block truncate text-[15px]">{r.name}</span>
                      </span>
                      <span className="mono text-[13px]">{formatPrice(r.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
