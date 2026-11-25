'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useCartCount } from '@/stores/cart';
import { useUi } from '@/stores/ui';
import { useHydrated } from '@/hooks/useHydrated';
import { MobileMenu } from './MobileMenu';
import { HeaderMark as Mark } from './HeaderMark';
import { useT } from '@/i18n/client';
import { HERO_WIPE_EVENT, type HeaderTone, type HeroWipeDetail } from '@/lib/header-tone';

export interface NavSport {
  slug: string;
  name: string;
  tier: 'major' | 'minor';
  subs: { slug: string; name: string }[];
}

/** scrolled this far down the header steps away; this far back up it returns */
const HIDE_AFTER = 40;
const SHOW_AFTER = 12;
/** how often (at most) the header looks at what is under it while the page scrolls */
const SAMPLE_MS = 150;
/** the hero's slide wipe (keep in sync with --hero-t / --hero-ease in globals.css) */
const WIPE_MS = 1150;
const WIPE_EASE = 'cubic-bezier(0.76, 0, 0.18, 1)';

/**
 * The header: no bar — the STRYKE logo floats straight over the page on the left, the bag and a
 * bone-white-to-royal-blue "••• MENU" pill on the right, open space between.
 *
 * The letters (and the bag) take the colour of what is under them: bone white on dark, deep navy on
 * light (src/lib/header-tone.ts); the slash stays electric blue. Over the hero films the colour is
 * steady per slide, with a soft shadow, and when the slide changes the new colour follows the
 * slide's edge across the letters: a second copy of the row (`.sh-ghost`) in the new colour is
 * revealed with the same clip as the incoming film. It steps away (12px up, fading, 180ms) after
 * ~40px of scrolling down and comes back (260ms) after ~12px up; it stays at the top of the page and
 * while the menu is open. Everything runs on refs and data attributes — no React state per frame.
 */
export function Header({ nav }: { nav: NavSport[] }) {
  const t = useT();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const cartCount = useCartCount();
  const { set, menuOpen } = useUi();
  const [bump, setBump] = useState(false);
  const header = useRef<HTMLElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const home = useRef<HTMLAnchorElement>(null);
  const shown = useRef<() => void>(() => {});
  const menuRef = useRef(menuOpen);
  menuRef.current = menuOpen;

  useEffect(() => {
    const h = header.current;
    const row = base.current;
    const over = ghost.current;
    if (!h || !row || !over) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let wipe: Animation | null = null;
    let raf = 0;
    let lastY = window.scrollY;
    let down = 0;
    let up = 0;
    // what is painted now: attributes are only written when they change (a write restyles the header)
    let hidden = false;
    let tone: HeaderTone | null = null;
    let busy: boolean | null = null;
    // where to look (the middle of the logo): measured once, and again on resize — not every frame
    let px = 0;
    let py = 0;
    const measure = () => {
      const r = (home.current ?? row).getBoundingClientRect();
      px = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2));
      py = Math.max(0, r.top + r.height / 2 + (hidden ? 12 : 0));
    };
    // looking under the header is a hit test: while scrolling do it at most every SAMPLE_MS, plus
    // once when the scrolling stops — never on every frame, and not at all while the header is hidden
    let sampledAt = 0;
    let settle = 0;

    const setHidden = (hide: boolean) => {
      const next = hide && !menuRef.current;
      if (next === hidden) return;
      hidden = next;
      if (next) h.dataset.hidden = '';
      else {
        delete h.dataset.hidden;
        retone(); // the right colour as it comes back
      }
    };
    shown.current = () => {
      down = 0;
      setHidden(false);
    };

    /** what is under the logo: its tone, whether it is a photo/film, and whether it is the hero */
    const sample = () => {
      sampledAt = performance.now();
      for (const el of document.elementsFromPoint(px, py)) {
        if (h.contains(el)) continue;
        const src = el.closest<HTMLElement>('[data-header-tone]');
        if (src) return { tone: src.dataset.headerTone as HeaderTone, busy: src.hasAttribute('data-header-busy'), hero: src.hasAttribute('data-header-wipe') };
        return { tone: backgroundTone(el), busy: false, hero: false };
      }
      return { tone: 'light' as HeaderTone, busy: false, hero: false };
    };
    const paint = (t: HeaderTone, b: boolean) => {
      if (t !== tone) {
        tone = t;
        row.dataset.tone = t;
      }
      if (b !== busy) {
        busy = b;
        if (b) h.dataset.busy = '';
        else delete h.dataset.busy;
      }
    };
    function retone() {
      if (hidden) return;
      const s = sample();
      // a wipe in progress owns the colour while the hero is still under the header
      if (wipe) {
        if (s.hero) return;
        wipe.cancel();
      }
      paint(s.tone, s.busy);
    }

    const tick = (now: number) => {
      raf = 0;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (dy > 0) {
        down += dy;
        up = 0;
      } else if (dy < 0) {
        up -= dy;
        down = 0;
      }
      if (y <= HIDE_AFTER) setHidden(false);
      else if (down >= HIDE_AFTER) setHidden(true);
      else if (up >= SHOW_AFTER) setHidden(false);
      if (now - sampledAt >= SAMPLE_MS) retone();
      window.clearTimeout(settle);
      settle = window.setTimeout(retone, SAMPLE_MS);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onResize = () => {
      measure();
      retone();
    };

    // the hero changed slide: the new colour sweeps in with the film's edge
    const onWipe = (e: Event) => {
      const { from, to, dir } = (e as CustomEvent<HeroWipeDetail>).detail;
      const s = sample();
      if (!s.hero) return;
      wipe?.cancel();
      if (from === to || reduce.matches) {
        paint(to, true);
        return;
      }
      paint(from, true);
      over.dataset.tone = to;
      over.dataset.on = '';
      const a = over.animate([{ clipPath: dir === 1 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], {
        duration: WIPE_MS,
        easing: WIPE_EASE,
        fill: 'both',
      });
      wipe = a;
      a.onfinish = () => {
        if (wipe === a) wipe = null;
        // swap without a fade: the copy already shows the new colour
        row.dataset.snap = '';
        paint(to, true);
        void row.offsetWidth;
        delete row.dataset.snap;
        delete over.dataset.on;
        a.cancel();
      };
      a.oncancel = () => {
        if (wipe === a) wipe = null;
        delete over.dataset.on;
      };
    };

    // a keyboard user tabbing into the header brings it back
    const onFocus = () => shown.current();

    // a surface changes its tone (the hero's slide or film cut): look again
    const watch = new MutationObserver(() => retone());
    watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-header-tone'] });

    measure();
    retone();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener(HERO_WIPE_EVENT, onWipe);
    h.addEventListener('focusin', onFocus);
    // the page under the header changes after a navigation: look again once it has painted
    const later = window.setTimeout(retone, 120);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(later);
      window.clearTimeout(settle);
      watch.disconnect();
      wipe?.cancel();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener(HERO_WIPE_EVENT, onWipe);
      h.removeEventListener('focusin', onFocus);
    };
  }, [pathname]);

  // the menu is open: the header stays
  useEffect(() => {
    if (menuOpen) shown.current();
  }, [menuOpen]);

  // little pop whenever the bag count changes (and the header comes back to show where it went)
  useEffect(() => {
    if (!hydrated || !cartCount) return;
    shown.current();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 600);
    return () => window.clearTimeout(t);
  }, [cartCount, hydrated]);

  const menuLabel = t('Menu');

  return (
    <>
      <header ref={header} className="sh">
        <div ref={base} className="sh-row container-x" data-tone="light" style={{ animation: 'header-in 1.1s .2s var(--ease-expo) both' }}>
          <Link ref={home} href="/" className="sh-home" aria-label={t('STRYKE home')}>
            <Mark />
          </Link>
          <div className="sh-end">
            <button
              type="button"
              id="cart-button"
              className={`sh-cart ${bump ? 'scale-125' : ''}`}
              aria-label={hydrated ? t('Open bag, {n} items', { n: cartCount }) : t('Open bag')}
              onClick={() => set({ cartOpen: true })}
            >
              <Icon name="bag" size={24} />
              {hydrated && cartCount > 0 && (
                <span aria-hidden className="sh-badge mono">
                  {cartCount > 99 ? '99' : cartCount}
                </span>
              )}
            </button>
            <button type="button" className="sh-menu" aria-label={t('Open menu')} aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => set({ menuOpen: true })}>
              <Dots />
              <span>{menuLabel}</span>
            </button>
          </div>
        </div>
        {/* the same row in the next colour, revealed by the hero's slide edge (decoration only) */}
        <div ref={ghost} className="sh-ghost" aria-hidden inert>
          <div className="sh-row container-x">
            <span className="sh-home">
              <Mark />
            </span>
            <div className="sh-end">
              <span className={`sh-cart ${bump ? 'scale-125' : ''}`}>
                <Icon name="bag" size={24} />
              </span>
              <span className="sh-menu invisible">
                <Dots />
                <span>{menuLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </header>
      <MobileMenu nav={nav} />
    </>
  );
}

function Dots() {
  return (
    <span className="sh-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

/** no tone given: read the first solid background behind the element (dark if it is dim) */
function backgroundTone(el: Element): HeaderTone {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const m = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
    if (!m || (m.length > 3 && Number(m[3]) < 0.5)) continue;
    const [r, g, b] = m.map(Number) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110 ? 'dark' : 'light';
  }
  return 'light';
}
