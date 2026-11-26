'use client';
import { useEffect, useRef } from 'react';
import { HeaderMark } from '@/components/header/HeaderMark';
import { smoothScroll } from '@/lib/smooth-scroll';
import { INTRO_CARDS, INTRO_COOKIE } from '@/config/intro';

/** the first card is there from the first paint; the others flip by, one every STEP ms */
const STEP = 190;
/** the STRYKE card at least HOLD ms; the window opening OPEN ms; covered at most MAX ms from the flip-book's start */
const HOLD = 480;
const OPEN = 900;
const MAX = 5200;
/** scripts this late: the CSS fallback (no JavaScript) is about to hide it — don't start then */
const TOO_LATE = 5400;

/**
 * The first-visit intro (once per visit — StoreChrome only renders it without the INTRO_COOKIE):
 * on a frost-white page, a small portrait card flips through ancient Greek sport art — boxers,
 * wrestlers, pankration, a chariot race, bronze and marble athletes (public-domain museum photos) —
 * each growing out of the middle of the last, while a [0]→[100] count runs beside it. Then the
 * STRYKE card (royal blue, the logo in bone white) holds until the page has loaded, turns into a
 * window onto the real page under it, and that window opens to the whole screen.
 *
 * The first card pops in with the first paint (the page is never blank); the others flip once the
 * page's scripts run — each when its picture is ready, so every one is seen even on a slow phone.
 * The card is a hole in the white (a huge box-shadow), so the page shows through it at the end.
 * Reduced motion: no intro. Without JavaScript a CSS fallback hides it after a few seconds.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const win = card.current;
    if (!el || !win) return;
    // played: not again this visit (a session cookie, so the server knows before it renders)
    document.cookie = `${INTRO_COOKIE}=1; path=/; SameSite=Lax`;
    const end = () => {
      el.dataset.state = 'done';
      el.removeAttribute('data-header-tone'); // the header looks again at what is under it
      smoothScroll.release();
    };
    el.dataset.js = '';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || performance.now() > TOO_LATE) {
      end();
      return;
    }
    smoothScroll.hold();
    let stopped = false;
    const timers: number[] = [];
    const later = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, Math.max(0, ms))));

    const loaded = new Promise<void>((r) => {
      if (document.readyState === 'complete') r();
      else window.addEventListener('load', () => r(), { once: true });
    });
    const imgs = [...win.querySelectorAll<HTMLImageElement>('.intro-img')];
    const brand = win.querySelector<HTMLElement>('.intro-brand');
    const t0 = performance.now();
    el.dataset.flip = ''; // the count runs with the flip-book

    void (async () => {
      // one card after another (the first is already showing), each once its picture is ready
      for (let i = 1; i < imgs.length; i++) {
        const img = imgs[i]!;
        const ready = await Promise.race([img.decode().then(() => true, () => false), later(i < 3 ? 1200 : 450).then(() => false)]);
        if (stopped) return;
        if (ready) img.dataset.on = '';
        await later(STEP);
      }
      if (stopped) return;
      brand?.setAttribute('data-on', '');
      // hold the STRYKE card until the page has loaded (never past MAX from the flip-book's start)
      await Promise.race([loaded, later(MAX - OPEN - (performance.now() - t0))]);
      await later(HOLD);
      if (stopped) return;
      el.dataset.count = 'full'; // the count runs to 100
      await later(320);
      if (stopped) return;
      // the window onto the page opens to the whole screen
      el.dataset.state = 'open';
      const r = win.getBoundingClientRect();
      const sx = (window.innerWidth / r.width) * 1.04;
      const sy = (window.innerHeight / r.height) * 1.04;
      const a = win.animate([{ transform: 'none' }, { transform: `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})` }], {
        duration: OPEN,
        delay: 180,
        easing: 'cubic-bezier(0.76, 0, 0.24, 1)',
        fill: 'forwards',
      });
      a.onfinish = end;
    })();
    // safety: never keep the page covered
    const safety = window.setTimeout(() => {
      if (el.dataset.state !== 'done') end();
    }, MAX + 3000);

    return () => {
      stopped = true;
      window.clearTimeout(safety);
      for (const t of timers) window.clearTimeout(t);
      smoothScroll.release();
    };
  }, []);

  const flip = ((INTRO_CARDS.length - 1) * STEP) / 1000;
  return (
    <div ref={root} className="intro" data-state="play" data-header-tone="light" aria-hidden style={{ ['--flip' as string]: `${flip}s` }}>
      <div ref={card} className="intro-card">
        {INTRO_CARDS.map((c, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- small fixed cards, already sized
          <img
            key={c}
            src={`/intro/${c}.webp`}
            alt=""
            width={360}
            height={480}
            className="intro-img"
            style={{ zIndex: i + 1 }}
            fetchPriority={i < 4 ? 'high' : 'auto'}
            draggable={false}
          />
        ))}
        <div className="intro-brand" style={{ zIndex: INTRO_CARDS.length + 1 }}>
          <HeaderMark className="intro-mark" />
        </div>
        <span className="intro-count mono" dir="ltr" />
      </div>
    </div>
  );
}
