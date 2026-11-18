'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Hero } from '@/components/hero/Hero';
import type { CrystalApi } from '@/components/hero/crystal/CrystalHero';
import { HeroDrip } from './HeroDrip';
import { heroSlides } from '@/config/hero';
import { renderUrl } from '@/lib/format';

/** where in the hero's scroll the page takes the product over */
const HANDOFF = 0.32;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** falls with gravity, then a small settle on landing */
const fall = (q: number) => (q < 0.8 ? (q / 0.8) ** 2 : 1 - 0.065 * Math.sin((Math.PI * (q - 0.8)) / 0.2));

/**
 * Hero + the liquid chrome edge + the product drop: as you scroll on, the product leaves the 3D stage
 * as its real photo and falls out of the hero, landing on the white page below (it stays there and
 * links to the product). Scroll-scrubbed and reversible; driven by refs, never React state per frame.
 */
export function HomeHero() {
  const sport = useRef<string>('football');
  const api = useRef<CrystalApi | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const flyer = useRef<HTMLAnchorElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const [slide, setSlide] = useState(0);
  const st = useRef({
    on: false,
    src: null as null | { x: number; y: number; w: number; h: number; rot: number },
    wrapDocTop: 0,
    stageH: 0,
    handoffScroll: 0,
    p: 0,
    enabled: true,
  });

  const layout = useCallback(() => {
    const el = wrap.current;
    const hero = el?.previousElementSibling as HTMLElement | null;
    if (!el || !hero) return;
    const s = st.current;
    s.wrapDocTop = el.getBoundingClientRect().top + window.scrollY;
    // geometry is read here (mount / resize), never inside the scroll frame
    const top = hero.getBoundingClientRect().top + window.scrollY;
    s.stageH = (hero.querySelector('[data-testid="hero-stage"]') as HTMLElement | null)?.offsetHeight ?? window.innerHeight;
    s.handoffScroll = top + HANDOFF * Math.max(1, hero.offsetHeight - s.stageH);
  }, []);

  const frame = useCallback(() => {
    const s = st.current;
    const f = flyer.current;
    const sh = shadow.current;
    if (!f || !sh || !s.enabled) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const a = api.current;
    // hand-off: capture where the 3D product is right now, then hide it there
    if (s.p >= HANDOFF && !s.on) {
      const r = a?.productRect();
      if (!r || r.w < 4) return;
      s.src = r;
      s.on = true;
      a?.setDrop(true);
    } else if (s.p < HANDOFF && s.on) {
      s.on = false;
      a?.setDrop(false);
    }
    if (!s.on || !s.src) {
      f.style.visibility = 'hidden';
      sh.style.opacity = '0';
      f.style.pointerEvents = 'none';
      return;
    }
    // landing spot, in the wrapper's coordinates (the wrapper sits at the top of the white page)
    // it rests in the open space above the brands heading, sized to fit there whatever its shape
    const mobile = vw < 768;
    const aspect = s.src.h / Math.max(1, s.src.w);
    let lh = Math.min(vh * (mobile ? 0.17 : 0.24), 260);
    let lw = lh / aspect;
    const maxW = mobile ? vw * 0.62 : Math.min(vw * 0.34, 440);
    if (lw > maxW) {
      lw = maxW;
      lh = lw * aspect;
    }
    const lx = mobile ? vw * 0.5 : vw * 0.7;
    const ly = vh * 0.05 + lh / 2;
    // the stage holds still in the viewport until the hero ends, then scrolls away with it
    const wrapTopV = s.wrapDocTop - window.scrollY;
    const stageTopV = Math.min(0, wrapTopV - s.stageH);
    const sx = s.src.x + s.src.w / 2;
    const sy = s.src.y + s.src.h / 2 + stageTopV - wrapTopV;
    // progress: from the hand-off until the landing spot reaches the middle of the screen
    const startTop = s.wrapDocTop - s.handoffScroll;
    const endTop = vh * 0.52 - ly;
    const q = clamp((startTop - wrapTopV) / Math.max(1, startTop - endTop));
    const k = fall(q);
    const e = smooth(q);
    const w = lerp(s.src.w, lw, e);
    const h = lerp(s.src.h, lh, e);
    const x = lerp(sx, lx, e);
    const y = lerp(sy, ly, k);
    const rot = lerp((-s.src.rot * 180) / Math.PI, -7, e) - Math.sin(q * Math.PI) * 16;
    f.style.visibility = 'visible';
    f.style.width = `${w.toFixed(1)}px`;
    f.style.height = `${h.toFixed(1)}px`;
    f.style.transform = `translate3d(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    f.style.pointerEvents = q > 0.98 ? 'auto' : 'none';
    f.classList.toggle('is-landed', q > 0.98);
    sh.style.opacity = String(clamp((q - 0.55) / 0.45) * 0.9);
    sh.style.transform = `translate3d(${(lx - lw * 0.32).toFixed(1)}px, ${(ly + lh * 0.46).toFixed(1)}px, 0) scale(${(0.4 + 0.6 * clamp((q - 0.5) / 0.5)).toFixed(3)}, 1)`;
    sh.style.width = `${(lw * 0.64).toFixed(1)}px`;
  }, []);

  const onScroll = useCallback(
    (p: number, i: number) => {
      sport.current = heroSlides[i]?.id ?? 'football';
      st.current.p = p;
      setSlide((cur) => (cur === i ? cur : i));
      frame();
    },
    [frame],
  );

  useEffect(() => {
    st.current.enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    layout();
    const onResize = () => {
      layout();
      frame();
    };
    // the fall continues after the hero's own progress stops at 1
    const onWin = () => frame();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onWin, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onWin);
      ro.disconnect();
    };
  }, [layout, frame]);

  const hero = heroSlides[slide]!;
  return (
    <>
      <Hero onScrollProgress={onScroll} onApi={(a) => (api.current = a)} />
      <div ref={wrap} className="relative z-10 h-0">
        <HeroDrip sport={sport} />
        <span ref={shadow} aria-hidden className="hero-drop-shadow" />
        <a
          ref={flyer}
          href={`/product/${hero.product.slug}`}
          aria-label={`${hero.product.brand} ${hero.product.name}`}
          tabIndex={-1}
          className="hero-drop"
          style={{ visibility: 'hidden' }}
        >
          <span className="hero-drop-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={renderUrl(hero.product.slug)} alt="" draggable={false} />
          </span>
        </a>
      </div>
    </>
  );
}
