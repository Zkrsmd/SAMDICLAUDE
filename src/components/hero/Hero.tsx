'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { heroSlides } from '@/config/hero';
import { Icon } from '@/components/ui/Icon';
import { ProductImage } from '@/components/product/ProductImage';
import { Loader } from './Loader';
import { useReducedMotion } from '@/hooks/useHydrated';
import { detectQuality, webglAvailable, type HeroEngine } from '@/three/hero/engine';
import type { QualityTier } from '@/three/hero/common';

const HeroCanvas = dynamic(() => import('./HeroCanvas'), { ssr: false });

export interface HeroHandle {
  engine: HeroEngine | null;
  index: number;
}

/**
 * Cinematic three-sport hero. Native vertical scroll stays untouched (touch-action: pan-y);
 * horizontal drags, arrows, dots and ←/→ keys switch sport.
 */
export function Hero({ onScrollProgress }: { onScrollProgress?: (p: number, index: number) => void }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [loaderDone, setLoaderDone] = useState(false);
  const [uiIn, setUiIn] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [quality, setQuality] = useState<QualityTier | null>(null);
  const engine = useRef<HeroEngine | null>(null);
  const skipRef = useRef(false);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  // capability detection after mount
  useEffect(() => {
    const ok = webglAvailable();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!ok) setFallback(true);
    else setQuality(detectQuality());
    if (document.fonts?.ready) document.fonts.ready.then(() => setProgress((p) => Math.max(p, 0.1)));
  }, []);

  // fallback path: no WebGL → finish loading on fonts alone
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fallback) setProgress(1);
  }, [fallback]);

  const onLoaderDone = useCallback((skip: boolean) => {
    skipRef.current = skip;
    setLoaderDone(true);
    if (engine.current) engine.current.startIntro(skip);
    window.setTimeout(() => setUiIn(true), skip ? 200 : 1500);
  }, []);

  const onEngine = useCallback((e: HeroEngine) => {
    engine.current = e;
    if (process.env.NODE_ENV !== 'production') (window as Window & { __hero?: HeroEngine }).__hero = e;
    setEngineReady(true);
    if (loaderDoneRef.current) e.startIntro(skipRef.current);
    // preload the neighbouring scenes when the browser is idle
    const idle = (cb: () => void) => {
      const w = window as Window & { requestIdleCallback?: (f: () => void, o?: object) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout: 4000 });
      else window.setTimeout(cb, 2500);
    };
    window.setTimeout(() => idle(() => e.preload(1)), 4500);
    window.setTimeout(() => idle(() => e.preload(2)), 7500);
  }, []);
  const loaderDoneRef = useRef(false);
  loaderDoneRef.current = loaderDone;

  // scroll progress through the sticky hero → engine + drip transition
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (engine.current) engine.current.visible = visible;
    });
    io.observe(el);
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const max = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, max)));
      if (engine.current) engine.current.scroll = p;
      onScrollProgress?.(p, indexRef.current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [onScrollProgress]);

  const go = useCallback(
    (to: number, dir?: 1 | -1) => {
      const n = (to + heroSlides.length) % heroSlides.length;
      if (engine.current && !fallback) engine.current.goTo(n, dir);
      else setIndex(n);
    },
    [fallback],
  );
  const next = () => go(indexRef.current + 1, 1);
  const prev = () => go(indexRef.current - 1, -1);

  // pointer: swipe + parallax + product tap
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let st = 0;
    let lock: 'h' | 'v' | null = null;
    let down = false;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a,button')) return;
      down = true;
      sx = e.clientX;
      sy = e.clientY;
      st = performance.now();
      lock = null;
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (engine.current && e.pointerType === 'mouse') engine.current.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      if (!down) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!lock && Math.hypot(dx, dy) > 8) lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
      if (lock === 'h') engine.current?.drag(dx / r.width);
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - sx;
      const dt = performance.now() - st;
      if (lock === 'h') {
        const f = dx / r.width;
        const fast = Math.abs(dx) / Math.max(dt, 1) > 0.5;
        const commit = Math.abs(f) > 0.16 || (fast && Math.abs(f) > 0.05);
        if (engine.current) {
          engine.current.release(commit);
          if (commit) setUiIn(true);
        } else if (commit) {
          if (dx < 0) next();
          else prev();
        }
      } else if (!lock && engine.current) {
        // tap: open the category when the product is hit
        const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        if (engine.current.hitTest(ndc)) router.push(heroSlides[indexRef.current]!.href);
      }
      lock = null;
    };
    const onCancel = () => {
      if (down && lock === 'h') engine.current?.release(false);
      down = false;
      lock = null;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    }
  };

  const slide = heroSlides[index]!;
  const showPoster = fallback || !engineReady;

  return (
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label="Featured sports"
      className="relative h-[175svh]"
      onKeyDown={onKey}
    >
      <h1 className="sr-only">Sports equipment for football, boxing and swimming</h1>
      <div ref={stage} className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#F6F4EE] select-none" style={{ touchAction: 'pan-y' }}>
        {/* poster / fallback composition (also the no-WebGL and reduced-data experience) */}
        <div
          aria-hidden={!fallback}
          className={`absolute inset-0 transition-opacity duration-700 ${showPoster ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: slide.poster }}
        >
          <div className="display absolute inset-x-0 top-[22%] text-center text-[clamp(72px,21vw,260px)] text-ink/90">{slide.word}</div>
          <div className="absolute inset-x-[8%] top-[34%] bottom-[26%]">
            <ProductImage slug={slide.product.slug} colorId={slide.product.color} alt={slide.product.name} sizes="90vw" priority />
          </div>
        </div>

        {quality && !fallback && (
          <HeroCanvas
            quality={quality}
            initial={0}
            reducedMotion={reduced}
            events={{
              onIndex: (i) => setIndex(i),
              onIntroDone: () => setUiIn(true),
            }}
            onEngine={onEngine}
            onProgress={(p) => setProgress((x) => Math.max(x, 0.1 + p * 0.9))}
            onError={() => setFallback(true)}
          />
        )}

        {/* UI layer */}
        <div className="pointer-events-none absolute inset-0 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 64px)' }}>
          <div className="container-x flex items-start justify-between">
            <div className={`transition-all duration-700 ${uiIn ? 'opacity-100' : 'translate-y-2 opacity-0'}`}>
              <p className="eyebrow text-ink/70">
                <span className="text-ink">{String(index + 1).padStart(2, '0')}</span> / {String(heroSlides.length).padStart(2, '0')}
              </p>
              <p className="eyebrow mt-1 text-ink/55">{slide.product.name}</p>
            </div>
          </div>

          <div className="flex-1" />

          <div
            className={`container-x pb-[max(20px,env(safe-area-inset-bottom))] transition-all duration-700 ease-[var(--ease-expo)] ${
              uiIn ? 'opacity-100' : 'translate-y-6 opacity-0'
            }`}
          >
            <div aria-live="polite" aria-atomic="true">
              <h2 className="sr-only">{slide.word}</h2>
              <p key={`${slide.id}-t`} className="max-w-[22ch] text-[19px] font-medium leading-snug text-ink [animation:rise-in_.7s_.05s_var(--ease-expo)_both] md:text-[22px]">
                {slide.tagline}
              </p>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Link
                href={slide.href}
                className="btn btn-ink pointer-events-auto group h-[54px] flex-1 justify-between pl-5 pr-4 sm:flex-none sm:gap-8"
                style={{ boxShadow: `inset 0 -3px 0 ${slide.accent}` }}
              >
                {slide.cta}
                <Icon name="arrow-right" size={20} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <button type="button" onClick={prev} aria-label="Previous sport" className="pointer-events-auto grid h-[54px] w-[54px] place-items-center rounded-[2px] border border-ink/15 bg-white/70 backdrop-blur">
                <Icon name="arrow-left" size={20} />
              </button>
              <button type="button" onClick={next} aria-label="Next sport" className="pointer-events-auto grid h-[54px] w-[54px] place-items-center rounded-[2px] border border-ink/15 bg-white/70 backdrop-blur">
                <Icon name="arrow-right" size={20} />
              </button>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="flex gap-1.5" role="tablist" aria-label="Choose sport">
                {heroSlides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={s.word}
                    onClick={() => go(i, i > index ? 1 : -1)}
                    className="pointer-events-auto flex h-8 items-center"
                  >
                    <span className={`block h-[3px] rounded-full transition-all duration-500 ${i === index ? 'w-10 bg-ink' : 'w-5 bg-ink/25'}`} />
                  </button>
                ))}
              </div>
              <span className="eyebrow flex items-center gap-2 text-ink/60">
                Swipe · Scroll <span aria-hidden className="inline-block animate-bounce">↓</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Loader progress={fallback ? 1 : progress} active onDone={onLoaderDone} />
    </section>
  );
}
