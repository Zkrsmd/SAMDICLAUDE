'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { heroSlides, type HeroSlide } from '@/config/hero';
import { Icon } from '@/components/ui/Icon';
import { Loader } from './Loader';
import { renderUrl } from '@/lib/format';
import { useReducedMotion } from '@/hooks/useHydrated';

const AUTOPLAY_MS = 8000;
const WIPE_MS = 1200;
const HERO_ASSETS = heroSlides.flatMap((s) => [s.poster, renderUrl(s.product.slug)]);

/**
 * Cinematic three-sport hero on real media (video when supplied, still otherwise).
 * Slides change with a slanted clip-path wipe and a light sweep; the sport word slams in
 * letter by letter and the product cut-out flies in. Vertical scroll stays native (pan-y).
 */
export function Hero({ onScrollProgress }: { onScrollProgress?: (p: number, index: number) => void }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [tick, setTick] = useState(0);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const paused = hover || offscreen || reduced;

  const go = useCallback((to: number, d?: 1 | -1) => {
    const n = (to + heroSlides.length) % heroSlides.length;
    if (n === indexRef.current) return;
    setDir(d ?? (n > indexRef.current ? 1 : -1));
    setPrev(indexRef.current);
    setIndex(n);
    setTick((t) => t + 1);
  }, []);
  const next = useCallback(() => go(indexRef.current + 1, 1), [go]);
  const back = useCallback(() => go(indexRef.current - 1, -1), [go]);

  // autoplay
  useEffect(() => {
    if (!ready || paused) return;
    const t = window.setTimeout(next, AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [ready, paused, tick, next]);

  // drop the outgoing layer once the wipe has covered it
  useEffect(() => {
    if (prev === null) return;
    const t = window.setTimeout(() => setPrev(null), WIPE_MS + 100);
    return () => window.clearTimeout(t);
  }, [prev, tick]);

  // scroll progress, offscreen pause, pointer parallax (CSS variables — no React state per frame)
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
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      st.style.setProperty('--px', (e.clientX / window.innerWidth - 0.5).toFixed(3));
      st.style.setProperty('--py', (e.clientY / window.innerHeight - 0.5).toFixed(3));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
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

  return (
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label="Featured sports"
      className="relative h-[165svh] bg-[#07080A]"
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
      <h1 className="sr-only">SMADI — sports equipment for football, boxing and swimming</h1>
      <div
        ref={stage}
        data-testid="hero-stage"
        className="sticky top-0 h-[100svh] w-full select-none overflow-hidden text-white"
        style={{ touchAction: 'pan-y' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* media layers: outgoing darkens and drifts, incoming wipes in on a slant */}
        <div className="absolute inset-0" style={{ transform: 'scale(calc(1 + var(--sp, 0) * 0.12))', transformOrigin: '50% 30%' }}>
          {heroSlides.map((s, i) => {
            const isActive = i === index;
            const isPrev = i === prev;
            if (!isActive && !isPrev) return null;
            return (
              <div
                key={isActive ? `${s.id}-in-${tick}` : `${s.id}-out-${tick}`}
                aria-hidden
                className="absolute inset-0"
                style={{
                  zIndex: isActive ? 2 : 1,
                  animation:
                    animate && prev !== null
                      ? isActive
                        ? `hero-wipe-${dir > 0 ? 'l' : 'r'} ${WIPE_MS}ms cubic-bezier(.77,0,.18,1) both`
                        : `hero-out ${WIPE_MS}ms cubic-bezier(.77,0,.18,1) both`
                      : undefined,
                }}
              >
                <Media slide={s} active={isActive} animate={animate} />
              </div>
            );
          })}
        </div>

        {/* light sweep riding the wipe edge */}
        {animate && prev !== null && (
          <div
            key={`sweep-${tick}`}
            aria-hidden
            className="pointer-events-none absolute inset-y-[-10%] left-0 z-[3] w-[28vw]"
            style={{
              background: `linear-gradient(90deg, transparent, ${slide.glow}, rgba(255,255,255,.85), ${slide.glow}, transparent)`,
              filter: 'blur(18px)',
              mixBlendMode: 'screen',
              animation: `hero-sweep ${WIPE_MS}ms cubic-bezier(.77,0,.18,1) both`,
              transform: dir > 0 ? undefined : 'scaleX(-1)',
            }}
          />
        )}

        {/* legibility, vignette, accent glow, grain */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[3] bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,transparent_26%,transparent_50%,rgba(0,0,0,0.8)_100%)]" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[3] transition-[background] duration-1000"
          style={{ background: `radial-gradient(55% 45% at 68% 48%, ${slide.glow}, transparent 70%)`, mixBlendMode: 'soft-light' }}
        />

        {/* giant sport word, behind the product */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[15%] z-[4] px-2 md:top-[12%]"
          style={{ transform: 'translate3d(calc(var(--px, 0) * -24px), calc(var(--sp, 0) * -140px), 0)' }}
        >
          <WordBlast key={`${slide.id}-${tick}-${ready}`} word={slide.word} animate={animate} />
        </div>

        {/* product cut-out */}
        <div
          className="pointer-events-none absolute inset-x-[4%] top-[27%] bottom-[33%] z-[5] md:inset-x-auto md:bottom-[14%] md:right-[5%] md:top-[20%] md:w-[46%]"
          style={{ transform: 'translate3d(calc(var(--px, 0) * 34px), calc(var(--py, 0) * 22px + var(--sp, 0) * -80px), 0)' }}
        >
          <div
            key={`p-${slide.id}-${tick}-${ready}`}
            className="h-full w-full"
            style={{ animation: animate ? 'product-in 1.5s .3s cubic-bezier(.16,1,.3,1) both' : undefined, opacity: ready ? undefined : 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={renderUrl(slide.product.slug)}
              alt=""
              className="float-product h-full w-full object-contain"
              style={{ filter: `drop-shadow(0 30px 50px ${slide.glow}) drop-shadow(0 24px 24px rgba(0,0,0,.55))` }}
              draggable={false}
            />
          </div>
        </div>

        {/* UI */}
        <div className="absolute inset-0 z-[6] flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 96px)' }}>
          <div className="container-x flex items-center justify-between gap-4">
            <p key={`k-${tick}-${ready}`} className="mono text-[11px] uppercase tracking-[0.22em] text-white/85" style={{ animation: animate ? 'rise-in .8s .2s var(--ease-expo) both' : undefined }}>
              <span className="holo-text font-bold">{String(index + 1).padStart(2, '0')}</span>
              <span className="text-white/50"> / {String(heroSlides.length).padStart(2, '0')}</span> — {slide.kicker.split('— ')[1]}
            </p>
            <Link
              href={`/product/${slide.product.slug}`}
              className="mono hidden text-[11px] uppercase tracking-[0.18em] text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline md:block"
            >
              {slide.product.name}
            </Link>
          </div>

          <div className="flex-1" />

          <div className="container-x pb-[max(22px,env(safe-area-inset-bottom))]" style={{ opacity: ready ? 1 : 0, transition: 'opacity .8s .5s' }}>
            <div aria-live="polite" aria-atomic="true">
              <h2 className="sr-only">{slide.word}</h2>
              <p key={`t-${tick}-${ready}`} className="max-w-[16ch] text-[26px] font-semibold leading-[1.05] tracking-[-0.02em] md:text-[40px]" style={{ animation: animate ? 'rise-in .9s .45s var(--ease-expo) both' : undefined }}>
                {slide.tagline}
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2.5">
              <Link href={slide.href} className="btn-holo h-14 flex-1 sm:flex-none sm:px-9">
                {slide.cta} <Icon name="arrow-right" size={18} />
              </Link>
              <button type="button" onClick={back} aria-label="Previous sport" className="btn-glassy h-14 w-14 shrink-0 !px-0">
                <Icon name="arrow-left" size={18} />
              </button>
              <button type="button" onClick={next} aria-label="Next sport" className="btn-glassy h-14 w-14 shrink-0 !px-0">
                <Icon name="arrow-right" size={18} />
              </button>
            </div>

            {/* chapter bars with autoplay progress */}
            <div className="mt-5 flex items-center gap-3" role="group" aria-label="Choose sport">
              {heroSlides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={s.word}
                  aria-current={i === index ? 'true' : undefined}
                  className="group flex-1 py-2 text-left"
                >
                  <span className={`mono mb-2 block text-[10px] uppercase tracking-[0.2em] transition-colors ${i === index ? 'text-white' : 'text-white/45 group-hover:text-white/80'}`}>
                    {s.word}
                  </span>
                  <span className="block h-[3px] overflow-hidden rounded-full bg-white/20">
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

function Media({ slide, active, animate }: { slide: HeroSlide; active: boolean; animate: boolean }) {
  const [failed, setFailed] = useState(false);
  const hasVideo = Boolean(slide.video || slide.videoMobile) && !failed;
  return (
    <div className="absolute inset-0 overflow-hidden">
      {hasVideo ? (
        <video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="auto" poster={slide.poster} onError={() => setFailed(true)}>
          {slide.videoMobile && <source src={slide.videoMobile} media="(max-width: 767px)" type="video/mp4" />}
          {slide.video && <source src={slide.video} type="video/mp4" />}
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.poster}
          alt=""
          className="h-full w-full object-cover"
          style={{ animation: active && animate ? 'ken-burns 16s ease-out both' : undefined, transformOrigin: '60% 45%' }}
          draggable={false}
        />
      )}
    </div>
  );
}

/** The sport word slams in letter by letter: outlined, with a white-to-glass fill. */
function WordBlast({ word, animate }: { word: string; animate: boolean }) {
  const letters = word.toUpperCase().split('');
  return (
    <div className="[container-type:inline-size]">
      <div className="display whitespace-nowrap text-center leading-[0.82]" style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.35))', fontSize: `${Math.min(20, 96 / letters.length)}cqw` }}>
        {letters.map((ch, i) => (
          <span
            key={i}
            className="inline-block"
            style={{
              animation: animate ? `letter-slam .95s ${0.12 + i * 0.055}s cubic-bezier(.16,1,.3,1) both` : undefined,
              color: 'transparent',
              backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0.92) 40%, rgba(255,255,255,0.25) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}
