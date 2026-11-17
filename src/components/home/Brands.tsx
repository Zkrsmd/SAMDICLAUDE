'use client';
import { useEffect, useRef } from 'react';
import type { BrandEntry } from '@/types/catalog';

/** Two counter-drifting rows of typographic word-marks; scroll velocity nudges the drift. */
export function Brands({ brands }: { brands: BrandEntry[] }) {
  const rows = [useRef<HTMLUListElement>(null), useRef<HTMLUListElement>(null)];
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let x = 0;
    let lastY = window.scrollY;
    let boost = 0;
    const loop = () => {
      const y = window.scrollY;
      boost = boost * 0.92 + Math.abs(y - lastY) * 0.06;
      lastY = y;
      x += 0.35 + Math.min(boost, 6);
      rows.forEach((r, i) => {
        const el = r.current;
        if (!el) return;
        const half = el.scrollWidth / 2;
        const off = (x % half) * (i === 0 ? -1 : 1) - (i === 1 ? half : 0);
        el.style.transform = `translate3d(${off}px,0,0)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mark = (b: BrandEntry, k: string) => (
    <li
      key={k}
      className="flex shrink-0 items-center px-7 text-ink/70 transition-colors duration-300 hover:text-ink md:px-12"
      style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: b.weight,
        letterSpacing: `${b.tracking}em`,
        textTransform: b.style === 'upper' ? 'uppercase' : b.style === 'lower' ? 'lowercase' : 'none',
        fontSize: 'clamp(26px, 6vw, 44px)',
        fontStretch: b.style === 'upper' ? '85%' : '100%',
      }}
    >
      {b.name}
    </li>
  );
  const half = Math.ceil(brands.length / 2);
  const sets = [brands.slice(0, half), brands.slice(half)];

  return (
    <section aria-labelledby="brands-title" className="relative overflow-hidden bg-bg pb-16 pt-[30vh] md:pt-[32vh]">
      <div className="container-x">
        <p className="eyebrow text-muted">Brands we carry</p>
        <h2 id="brands-title" className="display mt-3 max-w-[12ch] text-[clamp(44px,11vw,120px)]">
          The brands behind the performance
        </h2>
        <p className="mt-4 max-w-md text-[15px] text-muted">
          Manufacturers whose products we stock. Names are shown as typography; we are not presenting them as official partners.
        </p>
      </div>
      <div className="mt-12 space-y-4 border-y border-line py-6 md:mt-16">
        {sets.map((set, i) => (
          <div key={i} className="overflow-hidden" aria-hidden={i === 1}>
            <ul ref={rows[i]} className="flex w-max will-change-transform" aria-label={i === 0 ? 'Brands' : undefined}>
              {[...set, ...set, ...set, ...set].map((b, k) => mark(b, `${b.id}-${k}`))}
            </ul>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {brands.map((b) => (
          <li key={b.id}>{b.name}</li>
        ))}
      </ul>
    </section>
  );
}
