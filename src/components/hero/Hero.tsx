'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { heroSlides } from '@/config/hero';
import { Icon } from '@/components/ui/Icon';
import { Loader } from './Loader';
import { CrystalHero, type CrystalApi } from './crystal/CrystalHero';
import { WORLDS } from './crystal/worlds';
import { renderUrl } from '@/lib/format';
import { useReducedMotion } from '@/hooks/useHydrated';

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
 * callouts, live readouts. Mono corner type, an index to jump between sports, a single CTA.
 */
export function Hero({ onScrollProgress }: { onScrollProgress?: (p: number, index: number) => void }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [tick, setTick] = useState(0);
  const [gate] = useState(deferred);
  const api = useRef<CrystalApi | null>(null);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const paused = hover || offscreen || reduced;

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
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        api.current?.setScroll(p);
        stage.current?.style.setProperty('--sp', p.toFixed(4));
        onScrollProgress?.(p, indexRef.current);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
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
      className="relative h-[170svh] bg-bg"
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
        className="sticky top-0 h-[100svh] w-full select-none overflow-hidden bg-[#A3ACB8] text-white"
        style={{ touchAction: 'pan-y' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <CrystalHero
          index={index}
          reduced={reduced}
          onReady={gate.resolve}
          onExplore={() => router.push(slide.href)}
          onApi={(a) => (api.current = a)}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent,rgba(16,22,30,0.38))]" />

        {/* corner type */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[3] [text-shadow:0_1px_10px_rgba(16,22,30,0.35)]"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 92px)', opacity: show, transition: 'opacity .8s .3s' }}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] [&_a]:pointer-events-auto [&_button]:pointer-events-auto" style={{ opacity: show, transition: 'opacity .8s .5s' }}>
          <div className="container-x pb-[max(22px,env(safe-area-inset-bottom))]">
            <div aria-live="polite" aria-atomic="true" className="[text-shadow:0_2px_24px_rgba(16,22,30,0.35)]">
              <h2 className="sr-only">{slide.word}</h2>
              <p key={`w-${tick}`} className="mono text-[10.5px] uppercase tracking-[0.18em] text-white/85" style={{ animation: ready ? 'rise-in .7s .15s var(--ease-expo) both' : undefined }}>
                {String(index + 1).padStart(2, '0')} — {slide.word} / {world.code}
              </p>
              <p
                key={`t-${tick}`}
                className="display mt-3 max-w-[14ch] text-[clamp(24px,min(7.4vw,7.2svh),64px)] leading-[0.95]"
                style={{ animation: ready ? 'rise-in .9s .25s var(--ease-expo) both' : undefined }}
              >
                {slide.tagline}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2.5 [@media(max-height:560px)]:mt-3">
              <Link href={slide.href} className="btn-holo h-14 flex-1 sm:flex-none sm:px-9">
                {slide.cta} <Icon name="arrow-right" size={18} />
              </Link>
              <button type="button" onClick={back} aria-label="Previous sport" className="btn-glassy h-14 w-14 shrink-0 !px-0">
                <Icon name="arrow-left" size={18} />
              </button>
              <button type="button" onClick={next} aria-label="Next sport" className="btn-glassy h-14 w-14 shrink-0 !px-0">
                <Icon name="arrow-right" size={18} />
              </button>
              <p className="mono ml-auto hidden text-right text-[10.5px] uppercase leading-[1.6] tracking-[0.14em] text-white/80 md:block">
                Scroll down to discover.
                <br />
                Drag to turn it. Click to explore.
              </p>
            </div>
          </div>
        </div>
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
