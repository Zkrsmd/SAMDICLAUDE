'use client';
import { useEffect, useRef, useState } from 'react';
import { renderUrl } from '@/lib/format';
import { heroIds, heroSlides } from '@/config/hero';

export interface CrystalApi {
  go: (index: number, dir: 1 | -1) => void;
  setScroll: (p: number) => void;
  start: () => void;
}

// start fetching the 3D code as soon as this island loads, not after hydration settles
const enginePromise = typeof window !== 'undefined' ? import('./engine') : null;

function webglOk() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

/**
 * Mounts the three.js crystal stage (code-split: three only loads on the client) plus its HUD:
 * a 2D overlay for survey numbers / callout lines and three DOM labels the engine positions.
 * Without WebGL 2 it shows a still, frosted-glass composition of the same product.
 */
export function CrystalHero({
  index,
  reduced,
  onReady,
  onExplore,
  onApi,
}: {
  index: number;
  reduced: boolean;
  onReady: () => void;
  onExplore: () => void;
  onApi: (api: CrystalApi | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const hud = useRef<HTMLCanvasElement>(null);
  const spec = useRef<HTMLDivElement>(null);
  const read = useRef<HTMLDivElement>(null);
  const readValue = useRef<HTMLSpanElement>(null);
  const explore = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const cb = useRef({ onReady, onExplore, onApi });
  cb.current = { onReady, onExplore, onApi };
  const first = useRef(index);

  useEffect(() => {
    if (!webglOk()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFallback(true);
      cb.current.onReady();
      return;
    }
    let disposed = false;
    let engine: import('./engine').CrystalEngine | null = null;
    const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--font-display-face').trim() || 'sans-serif';
    (async () => {
      try {
        const [{ CrystalEngine }] = await Promise.all([enginePromise ?? import('./engine'), document.fonts?.load(`900 100px ${fontFamily}`).catch(() => null)]);
        if (disposed) return;
        performance.mark('crystal:imported');
        engine = new CrystalEngine({
          canvas: canvas.current!,
          hud: hud.current!,
          labels: { spec: spec.current!, read: read.current!, readValue: readValue.current!, explore: explore.current! },
          ids: heroIds,
          productUrl: (slug) => renderUrl(slug),
          fontFamily,
          reduced,
          onExplore: () => cb.current.onExplore(),
          onReady: () => cb.current.onReady(),
        });
        cb.current.onApi({ go: (i, d) => engine?.go(i, d), setScroll: (p) => engine?.setScroll(p), start: () => engine?.start() });
        await engine.init(first.current);
      } catch {
        if (disposed) return;
        setFallback(true);
        cb.current.onReady();
      }
    })();
    return () => {
      disposed = true;
      cb.current.onApi(null);
      engine?.dispose();
    };
  }, [reduced]);

  const slide = heroSlides[index]!;
  if (fallback)
    return (
      <div className="absolute inset-0 grid place-items-center" style={{ background: 'radial-gradient(80% 60% at 50% 45%, #E3E7EC, #B4BCC6)' }}>
        <div className="glass relative grid aspect-[4/5] w-[min(70vw,380px)] place-items-center rounded-[28px]">
          <div className="float-wrap grid w-[80%] place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={renderUrl(slide.product.slug)} alt="" className="float-product w-full object-contain" />
          </div>
        </div>
      </div>
    );

  return (
    <>
      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
      <canvas ref={hud} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute left-0 top-0 z-[2] text-white [text-shadow:0_1px_8px_rgba(20,26,34,0.35)]">
        <div ref={spec} className="absolute left-0 top-0 whitespace-nowrap opacity-0 transition-opacity duration-500" style={{ willChange: 'transform' }}>
          <p data-code className="mono text-[10.5px] uppercase tracking-[0.16em]" />
          <p className="mono mt-0.5 max-w-[22ch] whitespace-normal text-[10.5px] font-bold uppercase leading-snug tracking-[0.12em]" data-scramble>
            {slide.product.brand} {slide.product.name}
          </p>
        </div>
        <div ref={read} className="absolute left-0 top-0 whitespace-nowrap opacity-0 transition-opacity duration-500" style={{ willChange: 'transform' }}>
          <p className="mono text-[10.5px] uppercase tracking-[0.16em]">
            <span data-label>TEMP</span>
          </p>
          <span ref={readValue} className="mono block text-[10.5px] tabular-nums tracking-[0.08em]" />
        </div>
        <div ref={explore} className="absolute left-0 top-0 whitespace-nowrap opacity-0 transition-opacity duration-500" style={{ willChange: 'transform' }}>
          <p className="mono text-[10.5px] uppercase tracking-[0.16em]">◇ SS26 — {String(index + 1).padStart(2, '0')}/{String(heroSlides.length).padStart(2, '0')}</p>
          <p className="mono text-[10.5px] font-bold uppercase tracking-[0.16em]">Click to explore</p>
        </div>
      </div>
    </>
  );
}
