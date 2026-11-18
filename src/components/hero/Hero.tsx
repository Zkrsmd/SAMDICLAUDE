'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { heroIds, heroSlides } from '@/config/hero';
import { Icon } from '@/components/ui/Icon';
import { HandMark } from '@/components/ui/Wordmark';
import { Loader } from './Loader';
import { Cinema, CUT_DELAY, filmAssets } from './cinema/Cinema';
import { SCENES } from './cinema/scenes';
import { useReducedMotion } from '@/hooks/useHydrated';

const AUTOPLAY_MS = 7600;
const HERO_ASSETS = filmAssets(heroIds);

/** studio light per sport, cross-faded under the film */
const TINT: Record<string, string> = {
  football:
    'radial-gradient(70% 45% at 58% 102%, rgba(93,187,63,.24), transparent 70%), radial-gradient(45% 42% at 88% 4%, rgba(255,196,130,.5), transparent 70%)',
  boxing:
    'radial-gradient(42% 62% at 62% -6%, rgba(232,186,96,.55), transparent 70%), radial-gradient(90% 50% at 50% 106%, rgba(120,88,48,.16), transparent 70%)',
  swimming:
    'radial-gradient(55% 45% at 25% 6%, rgba(150,235,240,.6), transparent 70%), linear-gradient(180deg, transparent 55%, rgba(46,197,211,.14))',
  basketball:
    'radial-gradient(55% 45% at 14% 4%, rgba(255,176,100,.48), transparent 70%), linear-gradient(180deg, transparent 62%, rgba(196,140,90,.16))',
};

/**
 * Cinematic hero: a bright studio where each sport plays a coded film of the real product
 * (strike, hook, dive, bounce) with camera moves, slow motion, sweat, splashes and light sweeps,
 * then settles into a floating exhibit. Vertical scroll stays native (touch-action: pan-y);
 * arrows, chapter buttons, ←/→ keys and swipes change sport.
 */
export function Hero({ onScrollProgress }: { onScrollProgress?: (p: number, index: number) => void }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [tick, setTick] = useState(0);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const timecode = useRef<HTMLSpanElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const paused = hover || offscreen || reduced;

  const go = useCallback((to: number, d?: 1 | -1) => {
    const n = (to + heroSlides.length) % heroSlides.length;
    if (n === indexRef.current) return;
    setDir(d ?? (n > indexRef.current ? 1 : -1));
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

  // scroll progress + offscreen pause (CSS variables, no React state per frame)
  useEffect(() => {
    const el = section.current;
    const st = stage.current;
    if (!el || !st) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e?.isIntersecting));
    io.observe(el);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        st.style.setProperty('--sp', p.toFixed(4));
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

  // horizontal swipe (direction locked after 10px so vertical scroll is untouched)
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
  const animate = ready && !reduced;
  // the word slams in on the film's impact frame
  const wordDelay = (SCENES[slide.id]?.wordAt ?? 0.5) + (tick > 0 ? CUT_DELAY : 0);
  const uiDelay = wordDelay + 0.25;

  return (
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label="Featured sports"
      className="relative h-[165svh] bg-bg"
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
        className="sticky top-0 h-[100svh] w-full select-none overflow-hidden text-ink"
        style={{ touchAction: 'pan-y' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* bright studio cyclorama, lit per sport */}
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(120% 95% at 58% 42%, #FFFFFF 0%, #F7F5F0 44%, #E6E1D6 100%)' }} />
        {heroSlides.map((s, i) => (
          <div key={s.id} aria-hidden className="absolute inset-0 transition-opacity duration-[1200ms] ease-out" style={{ background: TINT[s.id], opacity: i === index ? 1 : 0 }} />
        ))}

        <div className="absolute inset-0" style={{ transform: 'scale(calc(1 + var(--sp, 0) * 0.1))', transformOrigin: '60% 50%' }}>
          {/* the sport word as a moving set piece behind the product */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-[47%] z-[2] -translate-y-1/2 overflow-hidden md:top-[52%]"
            style={{ translate: 'var(--shx, 0) var(--shy, 0)' }}
          >
            <WordReel key={`${slide.id}-${tick}-${ready}`} word={slide.word} delay={wordDelay} animate={animate} accent={slide.accent} />
          </div>
          <Cinema ids={heroIds} index={index} dir={dir} ready={ready} reduced={reduced} stage={stage} timecode={timecode} />
        </div>

        {/* viewfinder frame */}
        <div aria-hidden className="pointer-events-none absolute inset-x-3 bottom-3 top-[84px] z-[6] md:inset-x-6 md:bottom-6 md:top-[96px]">
          {['left-0 top-0 border-l border-t', 'right-0 top-0 border-r border-t', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((c) => (
            <span key={c} className={`absolute h-5 w-5 border-ink/25 ${c}`} />
          ))}
        </div>

        {/* UI */}
        <div className="absolute inset-0 z-[7] flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 100px)' }}>
          <div className="container-x flex items-start justify-between gap-4">
            <p key={`k-${tick}-${ready}`} className="mono text-[11px] uppercase tracking-[0.22em] text-ink/70" style={{ animation: animate ? `rise-in .8s ${uiDelay}s var(--ease-expo) both` : undefined }}>
              <span className="font-bold text-ink">Scene {String(index + 1).padStart(2, '0')}</span>
              <span className="text-ink/40"> / {String(heroSlides.length).padStart(2, '0')}</span> — {slide.kicker}
            </p>
            <p className="mono flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ink/55" aria-hidden>
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: slide.accent }} />
              <span ref={timecode} className="tabular-nums">00:00:00:00</span>
            </p>
          </div>

          <div className="flex-1" />

          <div className="container-x pb-[max(22px,env(safe-area-inset-bottom))]">
            <div className="flex items-end justify-between gap-6">
              <div aria-live="polite" aria-atomic="true">
                <h2 className="sr-only">{slide.word}</h2>
                <p
                  key={`t-${tick}-${ready}`}
                  className="max-w-[15ch] text-[28px] font-semibold leading-[1.02] tracking-[-0.03em] md:text-[44px]"
                  style={{ animation: animate ? `rise-in .9s ${uiDelay}s var(--ease-expo) both` : undefined, opacity: ready ? undefined : 0 }}
                >
                  {slide.tagline}
                </p>
              </div>
              <Link
                href={`/product/${slide.product.slug}`}
                key={`pl-${tick}-${ready}`}
                className="glass group hidden max-w-[300px] shrink-0 items-center gap-4 rounded-2xl p-4 pr-5 transition-transform hover:-translate-y-1 lg:flex"
                style={{ animation: animate ? `rise-in .9s ${uiDelay + 0.1}s var(--ease-expo) both` : undefined }}
              >
                <span className="h-10 w-1 rounded-full" style={{ background: slide.accent }} />
                <span>
                  <span className="mono block text-[10px] uppercase tracking-[0.18em] text-muted">Featured · {slide.product.brand}</span>
                  <span className="mt-1 block text-[14px] font-semibold leading-snug">{slide.product.name}</span>
                  <span className="mono mt-2 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]">
                    View product <Icon name="arrow-right" size={12} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-2.5">
              <Link href={slide.href} className="btn-holo h-14 flex-1 sm:flex-none sm:px-9">
                {slide.cta} <Icon name="arrow-right" size={18} />
              </Link>
              <button type="button" onClick={back} aria-label="Previous sport" className="btn-glass-light h-14 w-14 shrink-0">
                <Icon name="arrow-left" size={18} />
              </button>
              <button type="button" onClick={next} aria-label="Next sport" className="btn-glass-light h-14 w-14 shrink-0">
                <Icon name="arrow-right" size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2.5" role="group" aria-label="Choose sport">
              {heroSlides.map((s, i) => (
                <button key={s.id} type="button" onClick={() => go(i)} aria-label={s.word} aria-current={i === index ? 'true' : undefined} className="group py-2 text-left">
                  <span className={`mono mb-2 block truncate text-[9.5px] uppercase tracking-[0.18em] transition-colors md:text-[10px] ${i === index ? 'text-ink' : 'text-ink/40 group-hover:text-ink/75'}`}>
                    {String(i + 1).padStart(2, '0')} {s.word}
                  </span>
                  <span className="block h-[3px] overflow-hidden rounded-full bg-ink/10">
                    <span
                      key={`${s.id}-${tick}-${paused}-${ready}`}
                      className="block h-full rounded-full"
                      style={{
                        background: 'var(--holo)',
                        width: i === index ? (paused || !ready ? '100%' : undefined) : '0%',
                        animation: i === index && ready && !paused ? `progress ${AUTOPLAY_MS}ms linear both` : undefined,
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Loader assets={HERO_ASSETS} onDone={() => setReady(true)} />
    </section>
  );
}

/**
 * The sport word repeated on a slow reel: raised white letters (pearl gradient, soft studio
 * shadow, a breath of the sport's colour at the foot) — drama from light, not from black.
 * The first visible pass slams in letter by letter on the film's impact frame.
 */
function WordReel({ word, delay, animate, accent }: { word: string; delay: number; animate: boolean; accent: string }) {
  const letters = word.toUpperCase().split('');
  const fill = `linear-gradient(180deg, #FFFFFF 6%, #EEEAE2 42%, #D3CCBF 74%, ${accent} 128%)`;
  return (
    <div
      className="display flex w-max whitespace-nowrap leading-[0.8]"
      style={{
        fontSize: 'clamp(150px, 30svh, 330px)',
        animation: animate ? `reel 60s ${delay}s linear infinite` : undefined,
        filter: 'drop-shadow(0 28px 34px rgba(23,26,24,0.22)) drop-shadow(0 3px 2px rgba(23,26,24,0.14))',
      }}
    >
      {[0, 1, 2, 3].map((c) => (
        <span key={c} className="flex items-center">
          {letters.map((ch, i) => (
            <span
              key={i}
              className="inline-block"
              style={{
                color: 'transparent',
                backgroundImage: c % 2 ? 'linear-gradient(180deg, rgba(23,26,24,0.09), rgba(23,26,24,0.04))' : fill,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                animation: animate ? `letter-slam .85s ${delay + (c === 0 ? i * 0.045 : 0.35 + i * 0.02)}s cubic-bezier(.16,1,.3,1) both` : undefined,
              }}
            >
              {ch}
            </span>
          ))}
          <HandMark className="mx-[0.2em] h-[0.42em] w-[0.42em] opacity-90" glow={false} />
        </span>
      ))}
    </div>
  );
}
