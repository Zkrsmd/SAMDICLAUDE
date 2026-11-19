'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { saveInventory } from '@/app/admin/actions';
import { AIcon, Badge, Empty, Thumb } from './ui';
import { Stepper, toast, useLeaveGuard } from './client';

export interface InvRow {
  slug: string;
  name: string;
  image: string;
  sku: string;
  size: string;
  qty: number;
  sport: string;
  sample: boolean;
}
const PAGE = 60;
const key = (r: { slug: string; size: string }) => `${r.slug}::${r.size}`;

/** Every variant (product × size) with its stock, edited in place and saved together. */
export function InventoryTable({ rows, sports, writable }: { rows: InvRow[]; sports: { slug: string; name: string }[]; writable: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pending, start] = useTransition();
  const filter = params.get('filter') ?? 'all';
  const sport = params.get('sport') ?? '';
  const dirty = Object.keys(edits).length > 0;
  useLeaveGuard(dirty);

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params.toString());
    if (v && v !== 'all') n.set(k, v);
    else n.delete(k);
    router.replace(`${path}${n.size ? `?${n}` : ''}`, { scroll: false });
    setPage(1);
  };

  const qty = (r: InvRow) => edits[key(r)] ?? r.qty;
  const view = useMemo(() => {
    const t = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      const n = edits[key(r)] ?? r.qty;
      if (filter === 'low' && !(n > 0 && n <= 3)) return false;
      if (filter === 'out' && n !== 0) return false;
      if (sport && r.sport !== sport) return false;
      const hay = `${r.name} ${r.sku} ${r.size}`.toLowerCase();
      return t.every((w) => hay.includes(w));
    });
  }, [rows, q, filter, sport, edits]);
  const pages = Math.max(1, Math.ceil(view.length / PAGE));
  const shown = view.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);
  const counts = {
    all: rows.length,
    low: rows.filter((r) => qty(r) > 0 && qty(r) <= 3).length,
    out: rows.filter((r) => qty(r) === 0).length,
  };

  const save = () =>
    start(async () => {
      const changes = Object.entries(edits).map(([k, v]) => {
        const [slug, size] = k.split('::') as [string, string];
        return { slug, size, qty: v };
      });
      const res = await saveInventory(changes);
      if (res.ok) {
        toast(`${changes.length} variant${changes.length === 1 ? '' : 's'} updated`);
        setEdits({});
        router.refresh();
      } else toast(res.error, 'bad');
    });

  return (
    <>
      {dirty && (
        <div className="adm-savebar" role="region" aria-label="Unsaved changes">
          <span className="flex-1 font-semibold">
            {Object.keys(edits).length} unsaved change{Object.keys(edits).length === 1 ? '' : 's'}
          </span>
          <button type="button" className="adm-btn" onClick={() => setEdits({})} disabled={pending}>
            Discard
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={pending || !writable}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
      <div className="adm-card overflow-hidden">
        <div className="adm-tabs" role="tablist" aria-label="Stock">
          {(
            [
              ['all', 'All'],
              ['low', 'Low stock'],
              ['out', 'Sold out'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className="adm-tab" onClick={() => setParam('filter', id)}>
              {label} <span className="num ml-1 text-[11.5px] text-[#8a939e]">{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="adm-toolbar">
          <div className="relative min-w-[200px] flex-1">
            <AIcon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a939e]" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by product, SKU or size"
              className="adm-input !pl-8"
              aria-label="Search inventory"
            />
          </div>
          <select className="adm-select !w-auto" value={sport} onChange={(e) => setParam('sport', e.target.value)} aria-label="Filter by sport">
            <option value="">All sports</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {shown.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th className="hidden sm:table-cell">SKU</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const n = qty(r);
                  const changed = key(r) in edits;
                  return (
                    <tr key={key(r)} data-selected={changed ? '' : undefined}>
                      <td className="min-w-[200px]">
                        <Link href={`/admin/products/${r.slug}`} className="group flex items-center gap-3">
                          <Thumb src={r.image} />
                          <span className="line-clamp-2 font-medium group-hover:underline">{r.name}</span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">
                        {r.size}
                        {n === 0 ? (
                          <span className="ml-2">
                            <Badge tone="bad">Sold out</Badge>
                          </span>
                        ) : n <= 3 ? (
                          <span className="ml-2">
                            <Badge tone="warn">Low</Badge>
                          </span>
                        ) : null}
                      </td>
                      <td className="mono hidden text-[12px] text-[#66707c] sm:table-cell">{r.sku || '—'}</td>
                      <td>
                        <Stepper
                          value={n}
                          label={`Stock for ${r.name}, ${r.size}`}
                          onChange={(v) =>
                            setEdits((e) => {
                              const next = { ...e };
                              if (v === r.qty) delete next[key(r)];
                              else next[key(r)] = v;
                              return next;
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nothing here">No variants match these filters.</Empty>
        )}
        <div className="adm-sep flex items-center justify-between px-4 py-3 text-[12.5px] text-[#66707c]">
          <span>{view.length} variants</span>
          <span className="flex items-center gap-1">
            <button type="button" className="adm-icon-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <AIcon name="chevron-left" size={16} />
            </button>
            <span className="num">
              {Math.min(page, pages)} / {pages}
            </span>
            <button type="button" className="adm-icon-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <AIcon name="chevron-right" size={16} />
            </button>
          </span>
        </div>
      </div>
    </>
  );
}
