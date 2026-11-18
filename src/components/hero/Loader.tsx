'use client';
import { useEffect, useRef, useState } from 'react';
import { brand } from '@/config/brand';
import { HandMark } from '@/components/ui/Wordmark';

const VISITED_KEY = 'smadi-visited-v1';
const SPORTS = ['Football', 'Boxing', 'Swimming', 'Running', 'Basketball', 'Fitness'];

/**
 * Opening sequence: the holographic hand draws in, SMADI rises letter by letter, a counter
 * tracks real progress (fonts + hero media), then the panel splits and a fog layer clears
 * over the hero. Skippable; ~0.7s for returning visitors; instant with reduced motion.
 */
export function Loader({ assets, onDone }: { assets: string[]; onDone: () => void }) {
  const [phase, setPhase] = useState<'load' | 'exit' | 'fog' | 'gone'>('load');
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLSpanElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = useRef(() => {});
  finish.current = () => {
    if (done.current) return;
    done.current = true;
    setPhase('exit');
    // the hand mark flies into the header logo
    const m = mark.current;
    const target = document.querySelector('header a[aria-label="SMADI home"] svg');
    if (m && target && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const a = m.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      m.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${dx * 0.55}px, ${dy * 0.5}px) scale(0.6) rotate(-12deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy}px) scale(${b.width / a.width})`, opacity: 0.2 },
        ],
        { duration: 950, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'forwards' },
      );
    }
    // the film starts once the panels have opened, so its first frames are seen
    window.setTimeout(() => onDoneRef.current(), 620);
    window.setTimeout(() => setPhase('fog'), 1000);
    window.setTimeout(() => setPhase('gone'), 1700);
  };

  useEffect(() => {
    let minMs = 2600;
    try {
      if (localStorage.getItem(VISITED_KEY)) minMs = 700;
      localStorage.setItem(VISITED_KEY, '1');
    } catch {
      /* storage blocked — keep the full intro */
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) minMs = 0;

    let loaded = 0;
    const total = assets.length + 1;
    const bump = () => {
      loaded += 1;
    };
    document.fonts?.ready.then(bump, bump);
    const imgs = assets.map((src) => {
      const img = new Image();
      img.onload = bump;
      img.onerror = bump;
      img.src = src;
      return img;
    });

    const start = performance.now();
    let shown = 0;
    let raf = 0;
    let s = 0;
    const loop = () => {
      const t = minMs ? Math.min(1, (performance.now() - start) / minMs) : 1;
      const real = loaded / total;
      shown += (Math.min(t, real) - shown) * 0.1;
      if (Math.min(t, real) >= 1 && shown > 0.995) shown = 1;
      const pct = Math.round(shown * 100);
      if (counter.current) counter.current.textContent = String(pct).padStart(3, '0');
      if (bar.current) bar.current.style.transform = `scaleX(${shown})`;
      if (word.current && performance.now() - start > 300 * s) {
        word.current.textContent = SPORTS[s % SPORTS.length]!;
        s += 1;
      }
      if (shown >= 1) {
        finish.current();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // never trap anyone behind the loader
    const safety = window.setTimeout(() => finish.current(), 9000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
      imgs.forEach((i) => (i.onload = i.onerror = null));
    };
  }, [assets]);

  if (phase === 'gone') return null;
  const exiting = phase !== 'load';

  return (
    <>
      {/* fog that hangs over the hero and clears */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[94] overflow-hidden"
        style={{ animation: exiting ? 'fog-clear 1.1s .25s cubic-bezier(.4,0,.2,1) both' : undefined, backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: '90vmax',
              height: '60vmax',
              left: `${[-30, 20, -10][i]}%`,
              top: `${[10, 40, 60][i]}%`,
              background: 'radial-gradient(closest-side, rgba(250,250,247,.95), rgba(250,250,247,0))',
              animation: `fog-drift ${6 + i * 2}s ${i * 0.4}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>

      {phase !== 'fog' && (
        <div role="status" aria-label="Loading SMADI" className="fixed inset-0 z-[95] overflow-hidden text-ink">
          {/* two halves that split apart on exit */}
          {(['top', 'bottom'] as const).map((half) => (
            <div
              key={half}
              aria-hidden
              className="absolute inset-x-0 bg-[#FAFAF7]"
              style={{
                top: half === 'top' ? 0 : '50%',
                bottom: half === 'top' ? '50%' : 0,
                transform: exiting ? `translate3d(0, ${half === 'top' ? '-101%' : '101%'}, 0)` : 'none',
                transition: 'transform 1s cubic-bezier(.77,0,.18,1)',
              }}
            />
          ))}

          <div
            className="relative flex h-full flex-col"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div aria-hidden className="absolute inset-0 opacity-80 transition-opacity duration-500" style={{ opacity: exiting ? 0 : undefined, background: 'radial-gradient(60% 45% at 50% 45%, rgba(139,92,246,.10), rgba(94,231,223,.08) 40%, transparent 70%)' }} />
            <div className="container-x relative flex h-16 items-center justify-between" style={{ opacity: exiting ? 0 : 1, filter: exiting ? 'blur(8px)' : 'none', transition: 'opacity .45s, filter .45s' }}>
              <span className="eyebrow text-muted">Season 2026 — Collection</span>
              <button type="button" onClick={() => finish.current()} className="eyebrow rounded-full px-4 py-2 text-ink transition-colors hover:bg-ink/5">
                Skip intro
              </button>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center">
              <div ref={mark} className="relative" style={{ animation: 'rise-in 1s .1s var(--ease-expo) both' }}>
                <div aria-hidden className="absolute inset-[-40%] rounded-full opacity-60 blur-3xl transition-opacity duration-500" style={{ background: 'var(--holo-conic)', animation: 'spin-a 6s linear infinite', opacity: exiting ? 0 : undefined }} />
                <HandMark className="relative h-24 w-24 md:h-32 md:w-32" />
              </div>
              <h2 className="display mt-6 flex text-[clamp(64px,19vw,200px)] leading-[0.85]" aria-label={brand.name} style={{ opacity: exiting ? 0 : 1, filter: exiting ? 'blur(8px)' : 'none', transition: 'opacity .45s, filter .45s' }}>
                {brand.name.split('').map((ch, i) => (
                  <span key={i} className="mask-line">
                    <span style={{ ['--d' as string]: `${350 + i * 80}ms` }}>{ch}</span>
                  </span>
                ))}
              </h2>
              <p className="mono mt-5 flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-muted" style={{ animation: 'rise-in 1s .9s var(--ease-expo) both', opacity: exiting ? 0 : undefined, transition: 'opacity .3s' }}>
                Gear for <span ref={word} className="holo-text inline-block min-w-[11ch] font-bold">Football</span>
              </p>
            </div>

            <div className="container-x relative pb-8" style={{ opacity: exiting ? 0 : 1, filter: exiting ? 'blur(8px)' : 'none', transition: 'opacity .45s, filter .45s' }}>
              <div className="flex items-end justify-between">
                <span ref={counter} aria-hidden className="display text-[72px] leading-none tabular-nums md:text-[96px]">
                  000
                </span>
                <span className="eyebrow pb-3 text-muted">Loading the arena</span>
              </div>
              <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-ink/10">
                <div ref={bar} className="h-full origin-left rounded-full" style={{ background: 'var(--holo)', transform: 'scaleX(0)' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
