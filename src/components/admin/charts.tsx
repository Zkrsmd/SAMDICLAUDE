'use client';
import { useId, useMemo, useRef, useState } from 'react';
import { day, money, moneyShort } from './ui';

type Point = { date: string; sales: number; orders: number };

/** "nice" axis top: 1/2/2.5/5 × 10^n just above the data max */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * Sales (or orders) over time: one cobalt series, a 2px line over a faint area, recessive grid,
 * a crosshair + tooltip on hover/touch/keyboard, and a hidden table for screen readers.
 */
export function SalesChart({ series, metric = 'sales', height = 240 }: { series: Point[]; metric?: 'sales' | 'orders'; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const gid = useId().replace(/:/g, '');
  const W = 1000;
  const H = height;
  const pad = { l: 0, r: 0, t: 8, b: 0 };
  const vals = series.map((p) => (metric === 'sales' ? p.sales : p.orders));
  const top = niceMax(Math.max(...vals, 0));
  const x = (i: number) => pad.l + (series.length < 2 ? 0 : (i / (series.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const fmt = (v: number) => (metric === 'sales' ? moneyShort(v) : String(Math.round(v)));
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = `${line}L${x(vals.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  const every = Math.ceil(series.length / 6);

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  const h = hover !== null ? series[hover] : null;
  return (
    <div>
      <div
        ref={box}
        className="relative ml-[50px] mr-1 mb-6 touch-pan-y select-none rounded-md outline-none"
        tabIndex={0}
        role="img"
        aria-label={`${metric === 'sales' ? 'Sales' : 'Orders'} per day, ${day(series[0]?.date ?? '')} to ${day(series.at(-1)?.date ?? '')}. Use arrow keys to read each day.`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((i) => Math.min(series.length - 1, (i ?? -1) + 1));
          if (e.key === 'ArrowLeft') setHover((i) => Math.max(0, (i ?? series.length) - 1));
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" preserveAspectRatio="none" style={{ height }}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-cobalt)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-cobalt)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(15 18 22 / 0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
          <path d={area} fill={`url(#g${gid})`} />
          <path d={line} fill="none" stroke="var(--color-cobalt)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="rgb(15 18 22 / 0.3)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* axis labels in HTML so they don't stretch with the plot */}
        {ticks.map((t) => (
          <span key={t} className="mono pointer-events-none absolute right-[calc(100%+8px)] -translate-y-1/2 whitespace-nowrap text-right text-[10.5px] text-[#8a939e]" style={{ top: `${(y(t) / H) * 100}%` }}>
            {fmt(t)}
          </span>
        ))}
        {series.map((p, i) =>
          (i % every === 0 && i < series.length - every / 2) || i === series.length - 1 ? (
            <span
              key={p.date}
              className={`mono pointer-events-none absolute top-[calc(100%+6px)] whitespace-nowrap text-[10.5px] text-[#8a939e] ${i === 0 ? '' : i === series.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: `${(x(i) / W) * 100}%` }}
            >
              {day(p.date)}
            </span>
          ) : null,
        )}
        {h && hover !== null && (
          <>
            <span
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-cobalt)] ring-2 ring-white"
              style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(vals[hover]!) / H) * 100}%` }}
            />
            <div className="adm-chart-tip" style={{ left: `clamp(70px, ${(x(hover) / W) * 100}%, calc(100% - 70px))` }}>
              <p className="text-[11.5px] text-[#66707c]">{day(h.date)}</p>
              <p className="num text-[14px] font-semibold">{money(h.sales)}</p>
              <p className="text-[11.5px] text-[#66707c]">
                {h.orders} order{h.orders === 1 ? '' : 's'}
              </p>
            </div>
          </>
        )}
      </div>
      <table className="sr-only">
        <caption>{metric === 'sales' ? 'Sales' : 'Orders'} per day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Sales</th>
            <th>Orders</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.date}>
              <td>{day(p.date)}</td>
              <td>{money(p.sales)}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tiny trend line for a KPI tile (decorative: the number beside it carries the meaning). */
export function Sparkline({ values }: { values: number[] }) {
  const d = useMemo(() => {
    const top = Math.max(...values, 1);
    return values.map((v, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, values.length - 1)) * 100).toFixed(1)},${(28 - (v / top) * 26).toFixed(1)}`).join('');
  }, [values]);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <path d={d} fill="none" stroke="var(--color-cobalt)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Ranked horizontal bars (one hue: magnitude). Each row is labelled, so colour carries nothing alone. */
export function BarList({ rows, format = 'money' }: { rows: { label: string; value: number }[]; format?: 'money' | 'count' }) {
  const top = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format === 'money' ? money(r.value) : r.value} (${Math.round((r.value / total) * 100)}%)`}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate font-medium">{r.label}</span>
            <span className="num shrink-0 text-[12.5px] text-[#4a525c]">
              {format === 'money' ? money(r.value) : r.value} <span className="text-[#8a939e]">· {Math.round((r.value / total) * 100)}%</span>
            </span>
          </div>
          <div className="adm-bar-track">
            <div className="adm-bar" style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
