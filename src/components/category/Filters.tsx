'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Icon } from '@/components/ui/Icon';
import { FAMILY_SWATCH } from '@/lib/color';
import { useDialog } from '@/hooks/useDialog';
import type { FacetSet } from '@/lib/catalog';

const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'name', label: 'Name A–Z' },
];

/** URL-synced filters (brand, colour, size, price) and sort. Works with back/forward. */
export function Filters({ facets, total }: { facets: FacetSet; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const sheet = useRef<HTMLDivElement>(null);
  useDialog(sheet, open, () => setOpen(false));

  const get = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean);
  const active = useMemo(
    () => ({ brand: get('brand'), color: get('color'), size: get('size'), min: params.get('min') ?? '', max: params.get('max') ?? '', sort: params.get('sort') ?? 'featured' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  );
  const push = (next: URLSearchParams) => {
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  const toggle = (k: 'brand' | 'color' | 'size', v: string) => {
    const next = new URLSearchParams(params.toString());
    const cur = new Set(get(k));
    if (cur.has(v)) cur.delete(v);
    else cur.add(v);
    if (cur.size) next.set(k, [...cur].join(','));
    else next.delete(k);
    push(next);
  };
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    push(next);
  };
  const clear = () => push(new URLSearchParams(params.get('sort') ? { sort: params.get('sort')! } : {}));
  const count = active.brand.length + active.color.length + active.size.length + (active.min ? 1 : 0) + (active.max ? 1 : 0);

  const panel = (
    <div className="space-y-7">
      {facets.brands.length > 1 && (
        <fieldset>
          <legend className="eyebrow text-muted">Brand</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {facets.brands.map((b) => (
              <button key={b.id} type="button" className="chip" aria-pressed={active.brand.includes(b.id)} onClick={() => toggle('brand', b.id)}>
                {b.name} <span className="mono text-[11px] opacity-60">{b.count}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="eyebrow text-muted">Colour</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {facets.colors.map((c) => (
            <button key={c.id} type="button" className="chip capitalize" aria-pressed={active.color.includes(c.id)} onClick={() => toggle('color', c.id)}>
              <span className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: FAMILY_SWATCH[c.id] ?? '#ccc' }} aria-hidden />
              {c.id}
            </button>
          ))}
        </div>
      </fieldset>
      {facets.sizes.length > 1 && (
        <fieldset>
          <legend className="eyebrow text-muted">Size</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {facets.sizes.slice(0, 18).map((s) => (
              <button key={s.id} type="button" className="chip" aria-pressed={active.size.includes(s.id.toLowerCase())} onClick={() => toggle('size', s.id.toLowerCase())}>
                {s.id}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="eyebrow text-muted">Price (€)</legend>
        <div className="mt-3 flex items-center gap-2">
          <label className="sr-only" htmlFor="pmin">Minimum price</label>
          <input
            id="pmin"
            inputMode="decimal"
            placeholder={String(Math.floor(facets.priceRange[0] / 100))}
            defaultValue={active.min}
            onBlur={(e) => setParam('min', e.target.value.replace(/[^\d.]/g, ''))}
            className="h-11 w-24 rounded-[2px] border border-line bg-white px-3"
          />
          <span aria-hidden>—</span>
          <label className="sr-only" htmlFor="pmax">Maximum price</label>
          <input
            id="pmax"
            inputMode="decimal"
            placeholder={String(Math.ceil(facets.priceRange[1] / 100))}
            defaultValue={active.max}
            onBlur={(e) => setParam('max', e.target.value.replace(/[^\d.]/g, ''))}
            className="h-11 w-24 rounded-[2px] border border-line bg-white px-3"
          />
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
      <div className="flex items-center gap-2">
        <button type="button" className="chip" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <Icon name="filter" size={16} /> Filter{count ? ` (${count})` : ''}
        </button>
        <label className="sr-only" htmlFor="sort">Sort by</label>
        <select id="sort" value={active.sort} onChange={(e) => setParam('sort', e.target.value === 'featured' ? '' : e.target.value)} className="chip appearance-none pr-8">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="mono ml-auto text-[12px] text-muted" aria-live="polite">
          {pending ? 'Updating…' : `${total} results`}
        </span>
      </div>
      {count > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...active.brand.map((v) => ['brand', v]), ...active.color.map((v) => ['color', v]), ...active.size.map((v) => ['size', v])].map(([k, v]) => (
            <button key={`${k}-${v}`} type="button" className="chip h-8 capitalize" onClick={() => toggle(k as 'brand', v!)} aria-label={`Remove ${v}`}>
              {v} <Icon name="close" size={14} />
            </button>
          ))}
          {(active.min || active.max) && (
            <button type="button" className="chip h-8" onClick={() => push(new URLSearchParams([...params.entries()].filter(([k]) => k !== 'min' && k !== 'max')))}>
              €{active.min || '0'}–{active.max || '∞'} <Icon name="close" size={14} />
            </button>
          )}
          <button type="button" className="eyebrow px-2 underline" onClick={clear}>
            Clear all
          </button>
        </div>
      )}

      <div aria-hidden={!open} inert={!open} className={`fixed inset-0 z-[75] ${open ? '' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-ink/30 transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={() => setOpen(false)} />
        <div
          ref={sheet}
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className={`absolute inset-x-0 bottom-0 max-h-[86svh] overflow-y-auto rounded-t-[10px] bg-bg p-5 transition-transform duration-700 ease-[var(--ease-expo)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none ${
            open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full md:translate-y-0'
          }`}
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <div className="mb-6 flex items-center">
            <h2 className="display text-[34px]">Filter</h2>
            <button type="button" className="-mr-2 ml-auto grid h-11 w-11 place-items-center" aria-label="Close filters" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          {panel}
          <div className="sticky bottom-0 mt-8 grid grid-cols-2 gap-3 bg-bg pt-3">
            <button type="button" className="btn btn-line" onClick={clear}>
              Clear
            </button>
            <button type="button" className="btn btn-ink" onClick={() => setOpen(false)}>
              Show {total}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
