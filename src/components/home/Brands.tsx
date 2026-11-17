'use client';
import { useEffect, useRef } from 'react';
import type { BrandEntry } from '@/types/catalog';

type B = BrandEntry & { logo?: string };

/**
 * Official brand marks drifting in two counter-rows; scroll velocity speeds them up.
 * Marks sit in ink and light up to full colour with a holo glow on hover.
 */
export function Brands({ brands }: { brands: B[] }) {
  const r0 = useRef<HTMLUListElement>(null);
  const r1 = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rows = [r0, r1];
    let raf = 0;
    let x = 0;
    let lastY = window.scrollY;
    let boost = 0;
    const loop = () => {
      const y = window.scrollY;
      boost = boost * 0.92 + Math.abs(y - lastY) * 0.06;
      lastY = y;
      x += 0.4 + Math.min(boost, 7);
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
  }, []);

  const mark = (b: B, k: string) => (
    <li key={k} className="group relative flex h-24 shrink-0 items-center px-8 md:h-32 md:px-14">
      <span aria-hidden className="absolute inset-4 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-50" style={{ background: 'var(--holo-conic)' }} />
      {b.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.logo}
          alt=""
          draggable={false}
          className="relative h-9 w-auto max-w-[150px] object-contain opacity-80 transition-all duration-500 [filter:grayscale(1)_brightness(0)] group-hover:scale-110 group-hover:opacity-100 group-hover:[filter:none] md:h-12 md:max-w-[190px]"
        />
      ) : (
        <span
          className="relative text-[30px] text-ink/80 transition-all duration-500 group-hover:scale-110 group-hover:text-ink md:text-[42px]"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: `${b.tracking}em` }}
        >
          {b.name}
        </span>
      )}
    </li>
  );
  const half = Math.ceil(brands.length / 2);
  const sets = [brands.slice(0, half), brands.slice(half)];

  return (
    <section aria-labelledby="brands-title" className="relative overflow-hidden bg-bg pb-16 pt-[26vh] md:pt-[30vh]">
      <div className="container-x" data-reveal>
        <p className="eyebrow text-muted">Brands we carry</p>
        <h2 id="brands-title" className="display mt-3 max-w-[13ch] text-[clamp(36px,9.4vw,128px)]">
          The brands behind the <span className="holo-text">performance</span>
        </h2>
        <p className="mt-4 max-w-md text-[15px] text-muted">Official products from the manufacturers we stock. Logos are trademarks of their owners; no partnership is implied.</p>
      </div>
      <div className="relative mt-12 space-y-2 border-y border-line py-4 md:mt-16 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        {sets.map((set, i) => (
          <div key={i} className="overflow-hidden" aria-hidden>
            <ul ref={i === 0 ? r0 : r1} className="flex w-max will-change-transform">
              {[...set, ...set, ...set, ...set].map((b, k) => mark(b, `${b.id}-${k}`))}
            </ul>
          </div>
        ))}
      </div>
      <ul className="sr-only" aria-label="Brands">
        {brands.map((b) => (
          <li key={b.id}>{b.name}</li>
        ))}
      </ul>
    </section>
  );
}
