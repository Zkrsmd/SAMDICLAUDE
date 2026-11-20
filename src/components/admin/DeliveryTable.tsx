'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { saveDelivery } from '@/app/admin/actions';
import { Badge } from './ui';
import { toast, useLeaveGuard } from './client';

export interface DeliveryRow {
  code: number;
  name: string;
  ar: string;
  home: number | null;
  desk: number | null;
  /** starting price from the published list */
  start: { home: number | null; desk: number | null };
  estimate?: boolean;
}

const toText = (v: number | null) => (v === null ? '' : String(v));
const toNum = (s: string) => {
  const t = s.replace(/\s/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 && n <= 100_000 ? n : NaN;
};

/** Delivery prices per wilaya: home and stop desk, in DA. Empty = not offered there. */
export function DeliveryTable({ rows, writable, courier }: { rows: DeliveryRow[]; writable: boolean; courier: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vals, setVals] = useState(() => Object.fromEntries(rows.map((r) => [r.code, { home: toText(r.home), desk: toText(r.desk) }])));
  const [q, setQ] = useState('');
  const dirty = rows.some((r) => vals[r.code]!.home !== toText(r.home) || vals[r.code]!.desk !== toText(r.desk));
  useLeaveGuard(dirty);
  const bad = rows.filter((r) => Number.isNaN(toNum(vals[r.code]!.home)) || Number.isNaN(toNum(vals[r.code]!.desk)));
  const view = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => !t || r.name.toLowerCase().includes(t) || r.ar.includes(t) || String(r.code) === t);
  }, [rows, q]);

  const save = () =>
    start(async () => {
      const tariffs = Object.fromEntries(rows.map((r) => [String(r.code), { home: toNum(vals[r.code]!.home), desk: toNum(vals[r.code]!.desk) }]));
      const res = await saveDelivery(tariffs as Record<string, { home: number | null; desk: number | null }>);
      if (res.ok) {
        toast('Delivery prices saved');
        router.refresh();
      } else toast(res.error, 'bad');
    });

  const set = (code: number, k: 'home' | 'desk', v: string) => setVals((s) => ({ ...s, [code]: { ...s[code]!, [k]: v } }));

  return (
    <div className="adm-card overflow-hidden">
      <div className="adm-toolbar">
        <input type="search" className="adm-input max-w-[260px]" placeholder="Find a wilaya" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a wilaya" />
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="adm-btn"
            disabled={pending || !writable}
            onClick={() => setVals(Object.fromEntries(rows.map((r) => [r.code, { home: toText(r.start.home), desk: toText(r.start.desk) }])))}
          >
            Use starting prices
          </button>
          <button type="button" className="adm-btn adm-btn-primary" disabled={pending || !writable || !dirty || bad.length > 0} onClick={save}>
            {pending ? 'Saving…' : 'Save prices'}
          </button>
        </span>
      </div>
      {bad.length > 0 && (
        <p className="adm-banner mx-4 mb-2" data-tone="bad">
          Whole dinars only (0 to 100 000), or leave empty: {bad.map((r) => r.name).join(', ')}.
        </p>
      )}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th className="w-14">Code</th>
              <th>Wilaya</th>
              <th className="r">Home delivery (DA)</th>
              <th className="r">Stop desk (DA)</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => {
              const v = vals[r.code]!;
              const changed = toNum(v.home) !== r.start.home || toNum(v.desk) !== r.start.desk;
              return (
                <tr key={r.code}>
                  <td className="num text-[#66707c]">{String(r.code).padStart(2, '0')}</td>
                  <td>
                    <span className="font-semibold">{r.name}</span> <span className="text-[#8a939e]">{r.ar}</span>
                    <span className="ml-2 inline-flex gap-1">
                      {changed ? <Badge tone="info">Your price</Badge> : null}
                      {!changed && r.estimate ? <Badge tone="warn">Estimate</Badge> : null}
                      {v.home === '' && v.desk === '' ? <Badge>Not served</Badge> : null}
                    </span>
                  </td>
                  {(['home', 'desk'] as const).map((k) => (
                    <td key={k} className="r">
                      <input
                        className="adm-input num ml-auto w-[110px] text-right"
                        inputMode="numeric"
                        value={v[k]}
                        placeholder="—"
                        disabled={!writable}
                        aria-invalid={Number.isNaN(toNum(v[k])) || undefined}
                        aria-label={`${r.name}, ${k === 'home' ? 'home delivery' : 'stop desk'} price in DA`}
                        onChange={(e) => set(r.code, k, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="adm-sep px-4 py-3 text-[12.5px] text-[#66707c]">
        {courier} gives every shop its own rates. Starting prices are rates another {courier} shop published in 2026 (parcels up to 5 kg); put in the
        ones from your contract. Empty = not offered in that wilaya.
      </p>
    </div>
  );
}
