'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HERO_TALL_QUERY, heroFilm, heroSlides } from '@/config/hero';
import { useReducedMotion } from '@/hooks/useHydrated';
import { useLocale, useT } from '@/i18n/client';

/** how long a slide waits when its film can't play (autoplay blocked, data saver) */
const STILL_MS = 7000;
/** the wipe between two sports (keep in sync with --hero-t in globals.css) */
const SLIDE_MS = 1150;
const N = heroSlides.length;

/**
 * The opening: a full-screen film per slide (played muted inline, looping) with the name across it
 * in big see-through white type — the name opens the page. Each film plays through once, then the
 * next slide comes; after the last, the first again — the banner loops. On hover or off screen the
 * film just keeps looping where it is (no pause button: the owner's choice; reduced motion shows
 * the stills). The arrows on the screen edges, the index, a swipe or the arrow keys change slides
 * too. A new slide wipes in from the side it came from while the old film slides away under it.
 *
 * The hero holds still while the white page slides up over it (it is sticky; the page after it is
 * a sheet that covers it), slowly pushing in and darkening as it goes. All motion is CSS and refs —
 * no React state per frame.
 */
export function Hero() {
  const t = useT();
  // Arabic letters join: the word rises in whole, not letter by letter
  const joined = useLocale() === 'ar';
  const reduced = useReducedMotion();
  // first visit: the language picker is open over the hero — the films wait for it (the page reloads after)
  const gated = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-lang-gate');
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [moved, setMoved] = useState(false);
  const [hover, setHover] = useState(false);
  const [away, setAway] = useState(false);
  const section = useRef<HTMLElement>(null);
  const films = useRef<(HTMLVideoElement | null)[]>([]);
  const bar = useRef<HTMLSpanElement>(null);
  const indexRef = useRef(0);
  indexRef.current = index;
  const hold = hover || away || reduced || gated;
  const holdRef = useRef(hold);
  holdRef.current = hold;

  const go = useCallback((to: number, d?: 1 | -1) => {
    const n = (to + N) % N;
    const from = indexRef.current;
    if (n === from) return;
    setLeaving(from);
    setDir(d ?? (n > from ? 1 : -1));
    setMoved(true);
    setIndex(n);
  }, []);
  const next = useCallback(() => go(indexRef.current + 1, 1), [go]);
  const back = useCallback(() => go(indexRef.current - 1, -1), [go]);

  // the old film keeps moving under the wipe, then rests
  useEffect(() => {
    if (leaving === null) return;
    const t = window.setTimeout(() => {
      films.current[leaving]?.pause();
      setLeaving(null);
    }, SLIDE_MS + 60);
    return () => window.clearTimeout(t);
  }, [leaving, index]);

  // a new sport's film plays from its first frame (coming back to the top resumes it); the next
  // one starts buffering once it runs
  const started = useRef(-1);
  useEffect(() => {
    const v = films.current[index];
    if (!v) return;
    if (away || gated) {
      v.pause();
      return;
    }
    if (started.current !== index) v.currentTime = 0;
    started.current = index;
    void v.play().catch(() => {});
    const warm = () => {
      const nx = films.current[(index + 1) % N];
      if (nx && nx.preload !== 'auto') {
        nx.preload = 'auto';
        nx.load();
      }
    };
    v.addEventListener('playing', warm, { once: true });
    return () => v.removeEventListener('playing', warm);
  }, [index, away]);

  // progress (the index underline) follows the film; once it has played through (it loops, so
  // its time jumps back to the start) the next slide comes — unless held. A still slide is timed.
  useEffect(() => {
    if (away) return;
    let raf = 0;
    const t0 = performance.now();
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const v = films.current[indexRef.current];
      const playing = v && !v.paused && v.readyState > 2 && v.duration > 0;
      const k = playing ? v.currentTime / v.duration : Math.min(1, (now - t0) / STILL_MS);
      bar.current?.style.setProperty('transform', `scaleX(${(holdRef.current && !playing ? 1 : k).toFixed(4)})`);
      if (playing) {
        const looped = k + 0.5 < last;
        last = k;
        if (looped && !holdRef.current) next();
        return;
      }
      // no film to wait for (it could not start): move on by time
      if (!holdRef.current && now - t0 > STILL_MS) next();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [index, away, reduced, next]);

  // as the page slides over the hero: push in, darken, lift the word; pause once it is covered
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    let raf = 0;
    let last = -1;
    let wasAway = false;
    const apply = () => {
      raf = 0;
      const vh = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, window.scrollY / vh));
      if (Math.abs(p - last) > 0.0005) {
        last = p;
        el.style.setProperty('--p', p.toFixed(4));
      }
      const a = window.scrollY > vh * 0.98;
      if (a !== wasAway) {
        wasAway = a;
        setAway(a);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // swipe sideways anywhere on the stage (vertical drags stay page scrolls)
  useEffect(() => {
    const el = section.current;
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

  return (
    <section
      ref={section}
      aria-roledescription="carousel"
      aria-label={t('Featured sports')}
      data-testid="hero-stage"
      data-moved={moved ? '' : undefined}
      className="hero-stage"
      style={{ '--d': dir } as React.CSSProperties}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
      <h1 className="sr-only">{t('STRYKE — sports equipment for football, boxing, swimming, fitness, martial arts and more')}</h1>

      <div className="hero-slides" aria-hidden>
        {heroSlides.map((s, i) => {
          const f = heroFilm(s.film);
          const pos = i === index ? 'current' : i === leaving ? 'leaving' : 'idle';
          return (
            <div key={s.id} className="hero-slide" data-pos={pos}>
              <div className="hero-film">
                <picture>
                  <source media={HERO_TALL_QUERY} srcSet={f.tallStill} />
                  <img src={f.wideStill} alt="" draggable={false} fetchPriority={i === 0 ? 'high' : 'low'} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                </picture>
                {!reduced && (
                  <video
                    ref={(el) => {
                      films.current[i] = el;
                    }}
                    muted
                    loop
                    playsInline
                    disablePictureInPicture
                    preload={i === 0 ? 'auto' : 'none'}
                    tabIndex={-1}
                    onPlaying={(e) => e.currentTarget.setAttribute('data-live', '')}
                  >
                    <source src={f.tall} media={HERO_TALL_QUERY} type="video/mp4" />
                    <source src={f.wide} type="video/mp4" />
                  </video>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div aria-hidden className="hero-scrim" />

      {/* the sport's name, across the film: it opens the sport */}
      <div className="hero-words" aria-live="polite" aria-atomic="true">
        {heroSlides.map((s, i) => {
          const pos = i === index ? 'current' : i === leaving ? 'leaving' : null;
          if (!pos) return null;
          const letters = joined ? [t(s.word)] : t(s.word).toUpperCase().split('');
          const word = letters.map((c, k) => (
            <span key={k} className="hero-ch" style={{ '--i': k } as React.CSSProperties}>
              {c}
            </span>
          ));
          return pos === 'current' ? (
            <Link key={s.id} href={s.href} aria-label={t(s.cta)} data-pos="current" className="hero-word display" style={{ '--n': joined ? Math.max(4, Math.round(t(s.word).length * 0.8)) : letters.length } as React.CSSProperties}>
              {word}
            </Link>
          ) : (
            <span key={s.id} aria-hidden data-pos="leaving" className="hero-word display" style={{ '--n': joined ? Math.max(4, Math.round(t(s.word).length * 0.8)) : letters.length } as React.CSSProperties}>
              {word}
            </span>
          );
        })}
      </div>

      {/* corner type */}
      <div className="hero-ui pointer-events-none absolute inset-x-0 top-0 z-[4]" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 92px)' }}>
        <div className="container-x flex items-start justify-between gap-6">
          <div className="mono text-[10.5px] uppercase leading-[1.55] tracking-[0.14em] [@media(max-height:560px)]:hidden">
            <p dir="ltr">{'// STRYKE © 2026'}</p>
            <p className="mt-2 text-white/75">{t('Season 01')}</p>
          </div>
          <nav aria-label={t('Sports index')} className="pointer-events-auto ml-auto text-right">
            <ol className="[@media(max-height:560px)]:flex [@media(max-height:560px)]:gap-4" role="group" aria-label={t('Choose sport')}>
              {heroSlides.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-label={t(s.word)}
                    aria-current={i === index ? 'true' : undefined}
                    className={`mono group relative inline-flex min-h-[26px] items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] transition-colors duration-500 ${i === index ? 'text-white' : 'text-white/55 hover:text-white'}`}
                  >
                    <span className={`h-px transition-all duration-700 ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 group-hover:w-4'}`} />
                    {String(i + 1).padStart(2, '0')} {t(s.word)}
                    {i === index && (
                      <span aria-hidden className="absolute -bottom-0.5 right-0 h-px w-full overflow-hidden bg-white/20">
                        <span ref={bar} className="block h-full origin-left bg-white" style={{ transform: 'scaleX(0)' }} />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>

      {/* bottom: where you are */}
      <div className="hero-ui pointer-events-none absolute inset-x-0 bottom-0 z-[4]">
        <div className="container-x flex items-end justify-between gap-6 pb-[calc(100lvh-100svh+max(24px,env(safe-area-inset-bottom)))]">
          <p className="mono text-[10.5px] uppercase tracking-[0.18em] text-white/80">
            <span className="text-white">{String(index + 1).padStart(2, '0')}</span> / {String(N).padStart(2, '0')}
            <span className="sr-only"> — {t(slide.word)}</span>
          </p>
          <p aria-hidden className="hero-scroll mono hidden text-[10.5px] uppercase tracking-[0.18em] text-white/75 sm:flex">
            {t('Scroll')}
          </p>
        </div>
      </div>

      {/* two arrows on the edges of the screen: they say "slide" without a word */}
      <button type="button" onClick={back} aria-label={t('Previous sport')} className="hero-arrow hero-arrow-prev">
        <svg viewBox="0 0 22 44" aria-hidden>
          <path d="M17 3 5 22l12 19" />
        </svg>
      </button>
      <button type="button" onClick={next} aria-label={t('Next sport')} className="hero-arrow hero-arrow-next">
        <svg viewBox="0 0 22 44" aria-hidden>
          <path d="M5 3l12 19L5 41" />
        </svg>
      </button>
    </section>
  );
}
