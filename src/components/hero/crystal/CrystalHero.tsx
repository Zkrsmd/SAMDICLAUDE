'use client';
import { useEffect, useRef, useState } from 'react';
import { renderUrl } from '@/lib/format';
import { heroIds, heroSlides } from '@/config/hero';

export interface CrystalApi {
  go: (index: number, dir: 1 | -1) => void;
  setScroll: (p: number) => void;
  start: () => void;
  /** hide the 3D product while the page carries it (the scroll drop) */
  setDrop: (on: boolean) => void;
  /** the product photo's box on the stage canvas, in CSS px */
  productRect: () => { x: number; y: number; w: number; h: number; rot: number } | null;
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
        cb.current.onApi({
          go: (i, d) => engine?.go(i, d),
          setScroll: (p) => engine?.setScroll(p),
          start: () => engine?.start(),
          setDrop: (on) => engine?.setDrop(on),
          productRect: () => engine?.productRect() ?? null,
        });
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
      // full-bleed still (no WebGL 2): the sport's word as architecture, the product floating in front
      <div className="absolute inset-0 overflow-hidden" style={{ background: 'radial-gradient(90% 70% at 50% 42%, #DDE2E8, #A3ACB8 70%, #8E99A8)' }}>
        <p aria-hidden className="display absolute inset-x-0 top-[24%] select-none text-center text-[22vw] leading-none text-white/35">
          {slide.word}
        </p>
        <div className="float-wrap absolute inset-x-[8%] top-[22%] bottom-[34%] grid place-items-center md:inset-x-[22%]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={renderUrl(slide.product.slug)} alt="" className="float-product h-full w-full object-contain" />
        </div>
      </div>
    );

  return (
    <>
      <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full" />
      <canvas ref={hud} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: 'calc(1 - var(--melt, 0) * 2)' }} />
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
