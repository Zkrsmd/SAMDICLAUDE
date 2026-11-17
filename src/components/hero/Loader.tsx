'use client';
import { useEffect, useRef, useState } from 'react';
import { brand } from '@/config/brand';

const VISITED_KEY = 'yb-visited-v1';

/**
 * Bright studio loader. Shows real progress (fonts + 3D scene build + shader compile),
 * always offers Skip, and is shortened for returning visitors.
 */
export function Loader({ progress, onDone, active }: { progress: number; onDone: (skip: boolean) => void; active: boolean }) {
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const start = useRef(0);
  const minMs = useRef(1700);
  const done = useRef(false);
  const target = useRef(progress);
  target.current = progress;

  useEffect(() => {
    start.current = performance.now();
    try {
      if (localStorage.getItem(VISITED_KEY)) minMs.current = 550;
      localStorage.setItem(VISITED_KEY, '1');
    } catch {
      /* storage unavailable — keep defaults */
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) minMs.current = 0;
  }, []);

  // smooth counter (stops once the loader has finished)
  useEffect(() => {
    if (gone) return;
    let raf = 0;
    const loop = () => {
      setShown((s) => {
        const elapsed = performance.now() - start.current;
        const timeCap = minMs.current <= 0 ? 1 : Math.min(1, elapsed / minMs.current);
        const goal = Math.min(target.current, timeCap);
        return s + (goal - s) * 0.12;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [gone]);

  const finish = (skip: boolean) => {
    if (done.current) return;
    done.current = true;
    setLeaving(true);
    onDone(skip);
    window.setTimeout(() => setGone(true), 900);
  };

  useEffect(() => {
    if (active && shown > 0.985 && progress >= 1) finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, progress, active]);

  if (gone) return null;
  const pct = Math.round(shown * 100);
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`fixed inset-0 z-[95] flex flex-col overflow-hidden bg-[#F6F4EE] transition-opacity duration-[900ms] ease-[var(--ease-expo)] ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* soft studio light sweeping across the cyclorama */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(120% 70% at 50% 110%, rgba(23,26,24,0.07), transparent 60%), radial-gradient(60% 50% at 30% 20%, #ffffff, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/2 opacity-60"
        style={{
          background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.9), transparent)',
          animation: 'loader-sweep 2.4s cubic-bezier(.65,0,.35,1) infinite',
        }}
      />
      <div className="container-x relative flex h-14 items-center justify-between">
        <span className="eyebrow text-muted">Football · Boxing · Swimming</span>
        <button type="button" onClick={() => finish(true)} className="eyebrow rounded-[2px] px-3 py-2 text-ink hover:bg-ink/5">
          Skip intro
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center">
        <div className="relative">
          {/* hairlines that draw out from the centre */}
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 h-px -translate-x-1/2 bg-ink/40"
            style={{ width: `${Math.min(100, shown * 140)}vw`, opacity: 1 - shown * 0.6 }}
          />
          <h2
            className="display relative text-[clamp(56px,17vw,180px)] text-ink"
            style={{
              clipPath: `inset(${(1 - Math.min(1, shown * 1.4)) * 100}% 0 0 0)`,
              letterSpacing: `${0.12 - shown * 0.13}em`,
            }}
          >
            {brand.name}
          </h2>
          <span
            aria-hidden
            className="absolute -right-4 top-2 h-3 w-3 rounded-full bg-orange"
            style={{ transform: `scale(${shown})`, transition: 'transform .2s' }}
          />
        </div>
        <p className="mono mt-6 text-[12px] text-muted" style={{ opacity: Math.min(1, shown * 2) }}>
          {brand.tagline}
        </p>
      </div>

      <div className="container-x relative pb-8">
        <div className="flex items-end justify-between">
          <span aria-hidden className="display text-[64px] leading-none text-ink tabular-nums">
            {String(pct).padStart(3, '0')}
          </span>
          <span className="eyebrow pb-2 text-muted" aria-live="polite">
            {progress < 1 ? 'Preparing the studio' : 'Entering'}
          </span>
        </div>
        <div className="mt-3 h-px w-full bg-ink/10">
          <div className="h-px bg-ink" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <style>{`@keyframes loader-sweep { from { transform: translateX(0) } to { transform: translateX(300%) } }`}</style>
    </div>
  );
}
