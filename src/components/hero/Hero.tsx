'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { heroSlides } from '@/config/hero';
import { Loader } from './Loader';
import { CrystalHero, type CrystalApi } from './crystal/CrystalHero';
import { WORLDS } from './crystal/worlds';
import { renderUrl } from '@/lib/format';
import { useReducedMotion } from '@/hooks/useHydrated';
import { SplitWords } from '@/components/ui/SplitWords';

const AUTOPLAY_MS = 8200;
const HERO_ASSETS = heroSlides.map((s) => renderUrl(s.product.slug));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

/**
 * The opening: each sport's product breaks out of its own crystal (ice shard, glass slab,
 * water orb, cut gem) in a coded, atmospheric set, read by a HUD — survey network, specimen
 * callouts, live readouts. Mono corner type, an index to jump between sports, arrows on the edges.
 */
export function Hero({
  onScrollProgress,
  onApi,
}: {
  onScrollProgress?: (p: number, index: number) => void;
  /** the stage's API, for the page-level product drop */
  onApi?: (api: CrystalApi | null) => void;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  // once you scroll on, the product drops out of the stage: the sport must not change under it
  const [away, setAway] = useState(false);
  const [tick, setTick] = useState(0);
  const [gate] = useState(deferred);
  const api = useRef<CrystalApi | null>(null);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const paused = hover || offscreen || reduced || away;

  const go = useCallback((to: number, d?: 1 | -1) => {
    const n = (to + heroSlides.length) % heroSlides.length;
    if (n === indexRef.current) return;
    api.current?.go(n, d ?? (n > indexRef.current ? 1 : -1));
    setIndex(n);
    setTick((t) => t + 1);
  }, []);
  const next = useCallback(() => go(indexRef.current + 1, 1), [go]);
  const back = useCallback(() => go(indexRef.current - 1, -1), [go]);

  useEffect(() => {
    if (!ready || paused) return;
    const t = window.setTimeout(next, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [ready, paused, tick, next]);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e?.isIntersecting));
    io.observe(el);
    let raf = 0;
    // geometry measured on resize only, so scrolling never forces a layout
    let top = 0;
    let span = 1;
    const measure = () => {
      const r = el.getBoundingClientRect();
      top = r.top + window.scrollY;
      span = Math.max(1, r.height - window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = Math.min(1, Math.max(0, (window.scrollY - top) / span));
        api.current?.setScroll(p);
        setAway(p > 0.2);
        // the white pour (drawn by the stage) hides the type with it
        const m = Math.min(1, Math.max(0, (p - 0.36) / 0.64));
        stage.current?.style.setProperty('--melt', (m * m * (3 - 2 * m)).toFixed(4));
        onScrollProgress?.(p, indexRef.current);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [onScrollProgress]);

  // swipe anywhere off the crystal (the crystal itself spins / thaws)
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let lock: 'h' | 'v' | null = null;
    let down = false;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('a,button')) return;
      down = true;
      lock = null;
      sx = e.clientX;
      sy = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!down || lock) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 10) lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      const dx = e.clientX - sx;
      if (lock === 'h' && Math.abs(dx) > 50) (dx < 0 ? next : back)();
    };
    const onCancel = () => {
      down = false;
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
  }, [next, back]);

  const slide = heroSlides[index]!;
  const world = WORLDS[slide.id]!;
  const show = ready ? 1 : 0;

  return (
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label="Featured sports"
      className="relative h-[calc(100lvh+70svh)] bg-bg"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          next();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          back();
        }
      }}
    >
      <h1 className="sr-only">SMADI — sports equipment for football, boxing, swimming and basketball</h1>
      <div
        ref={stage}
        data-testid="hero-stage"
        className="sticky top-0 h-[100lvh] w-full select-none overflow-hidden bg-[#A3ACB8] text-white"
        style={{ touchAction: 'pan-y' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <CrystalHero
          index={index}
          reduced={reduced}
          onReady={gate.resolve}
          onExplore={() => router.push(slide.href)}
          onApi={(a) => {
            api.current = a;
            onApi?.(a);
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent,rgba(16,22,30,0.38))]" style={{ opacity: 'calc(1 - var(--melt, 0) * 1.6)' }} />

        {/* corner type */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[3] [text-shadow:0_1px_10px_rgba(16,22,30,0.35)]"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 92px)', opacity: show ? 'calc(1 - var(--melt, 0) * 2.2)' : 0, transition: 'opacity .8s .3s' }}
        >
          <div className="container-x flex items-start justify-between gap-6">
            <div className="mono text-[10.5px] uppercase leading-[1.55] tracking-[0.14em] [@media(max-height:560px)]:hidden">
              <p>{'// SMADI © 2026'}</p>
              <p className="mt-2 text-white/80">
                Season 01 —<br />
                Break the ice.
              </p>
            </div>
            <nav aria-label="Sports index" className="pointer-events-auto ml-auto text-right">
              <p className="mono text-[10.5px] uppercase tracking-[0.14em] text-white/80">{'////// Index'}</p>
              <ol className="mt-1.5 [@media(max-height:560px)]:flex [@media(max-height:560px)]:gap-4" role="group" aria-label="Choose sport">
                {heroSlides.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => go(i)}
                      aria-label={s.word}
                      aria-current={i === index ? 'true' : undefined}
                      className={`mono group relative inline-flex min-h-[26px] items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] transition-colors ${i === index ? 'text-white' : 'text-white/55 hover:text-white'}`}
                    >
                      <span className={`h-px transition-all duration-500 ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 group-hover:w-4'}`} />
                      {String(i + 1).padStart(2, '0')} {s.word}
                      {i === index && (
                        <span aria-hidden className="absolute -bottom-0.5 right-0 h-px w-full overflow-hidden bg-white/20">
                          <span
                            key={`${tick}-${paused}-${ready}`}
                            className="block h-full bg-white"
                            style={{ width: paused || !ready ? '100%' : undefined, animation: ready && !paused ? `progress ${AUTOPLAY_MS}ms linear both` : undefined }}
                          />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </div>

        {/* bottom: statement + actions */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] [&_a]:pointer-events-auto [&_button]:pointer-events-auto" style={{ opacity: show ? 'calc(1 - var(--melt, 0) * 1.5)' : 0, transition: 'opacity .8s .5s' }}>
          {/* the stage is the LARGE viewport (full bleed when the browser bar hides); keep the type inside the small one */}
          <div className="container-x flex items-end justify-between gap-6 pb-[calc(100lvh-100svh+max(26px,env(safe-area-inset-bottom)))]">
            <div aria-live="polite" aria-atomic="true" className="[text-shadow:0_2px_24px_rgba(16,22,30,0.35)]">
              <h2 className="sr-only">{slide.word}</h2>
              <p key={`w-${tick}`} className="mono text-[10.5px] uppercase tracking-[0.18em] text-white/85" style={{ animation: ready ? 'rise-in .7s .15s var(--ease-expo) both' : undefined }}>
                {String(index + 1).padStart(2, '0')} — {slide.word} / {world.code}
              </p>
              {/* the statement itself opens the sport: no button on the film */}
              <Link key={`t-${tick}`} href={slide.href} aria-label={slide.cta} className="hero-line display mt-3 block max-w-[14ch] text-[clamp(26px,min(6.6vw,6.4svh),58px)] leading-[0.95]">
                {ready ? <SplitWords text={slide.tagline} play /> : slide.tagline}
              </Link>
            </div>
            <p className="mono hidden shrink-0 text-right text-[10.5px] uppercase leading-[1.6] tracking-[0.14em] text-white/80 md:block">
              Scroll down to discover.
              <br />
              Drag to turn it. Click to explore.
            </p>
          </div>
        </div>

        {/* two arrows on the edges of the screen: they say "slide" without a word */}
        <button type="button" onClick={back} aria-label="Previous sport" className="hero-arrow hero-arrow-prev" style={{ opacity: show ? undefined : 0 }}>
          <svg viewBox="0 0 22 44" aria-hidden>
            <path d="M17 3 5 22l12 19" />
          </svg>
        </button>
        <button type="button" onClick={next} aria-label="Next sport" className="hero-arrow hero-arrow-next" style={{ opacity: show ? undefined : 0 }}>
          <svg viewBox="0 0 22 44" aria-hidden>
            <path d="M5 3l12 19L5 41" />
          </svg>
        </button>
      </div>
      <Loader
        assets={HERO_ASSETS}
        gate={gate.promise}
        onDone={() => {
          setReady(true);
          api.current?.start();
        }}
      />
    </section>
  );
}
