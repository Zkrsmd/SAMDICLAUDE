'use client';
import { useEffect, useRef } from 'react';

const STOPS: [number, [number, number, number]][] = [
  [0, [255, 106, 43]],
  [0.33, [255, 197, 61]],
  [0.66, [94, 231, 223]],
  [1, [139, 92, 246]],
];
function holoAt(x: number) {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i]!;
    const [b, cb] = STOPS[i + 1]!;
    if (x <= b) {
      const k = (x - a) / (b - a);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j]! - v) * k)).join(',')})`;
    }
  }
  return 'rgb(139,92,246)';
}

interface Drip {
  x: number;
  w: number;
  max: number;
  ph: number;
  sp: number;
}

/**
 * Liquid holo that oozes out of the hero's bottom edge as you scroll: real gooey merging
 * (SVG blur + alpha threshold) with a specular lighting pass so it reads as glossy liquid,
 * drips stretching, necking and letting go of droplets. Driven by scroll — no scroll hijacking.
 */
export function HeroDrip({ sport }: { sport: React.RefObject<string> }) {
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    void sport;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let drips: Drip[] = [];
    let dripEls: HTMLDivElement[] = [];
    let drops: { el: HTMLDivElement; d: number; t0: number; x: number; r: number }[] = [];
    let w = 0;
    let h = 0;

    const build = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      el.querySelectorAll('[data-drip],[data-drop]').forEach((n) => n.remove());
      const n = Math.max(7, Math.round(w / 70));
      let seed = 7;
      const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      drips = Array.from({ length: n }, (_, i) => ({
        x: ((i + 0.5 + (r() - 0.5) * 0.6) / n) * w,
        w: 14 + r() * 26,
        max: 30 + Math.pow(r(), 1.6) * h * 0.62,
        ph: r() * 6.28,
        sp: 0.5 + r() * 0.7,
      }));
      dripEls = drips.map((d) => {
        const e = document.createElement('div');
        e.dataset.drip = '';
        e.style.cssText = `position:absolute;top:0;left:${d.x - d.w / 2}px;width:${d.w}px;height:0;border-radius:0 0 ${d.w}px ${d.w}px;background:${holoAt(d.x / w)};will-change:height`;
        el.appendChild(e);
        return e;
      });
      drops = Array.from({ length: 10 }, () => {
        const e = document.createElement('div');
        e.dataset.drop = '';
        e.style.cssText = 'position:absolute;top:0;left:0;border-radius:50%;opacity:0;will-change:transform';
        el.appendChild(e);
        return { el: e, d: -1, t0: 0, x: 0, r: 0 };
      });
    };
    build();
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - w) > 40) build();
    });
    ro.observe(el);

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting), { rootMargin: '200px 0px' });
    io.observe(el);
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || now - last < 30) return;
      last = now;
      const top = el.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (window.innerHeight - top) / (window.innerHeight * 0.8)));
      const grow = reduced ? (p > 0.15 ? 1 : 0) : p * p * (3 - 2 * p);
      const t = now / 1000;
      drips.forEach((d, i) => {
        const wob = reduced ? 0 : Math.sin(t * d.sp + d.ph) * 0.1 + Math.sin(t * d.sp * 2.3 + d.ph) * 0.04;
        const L = Math.max(0, d.max * grow * (0.9 + wob));
        dripEls[i]!.style.height = `${(L + 18).toFixed(1)}px`;
        // let a droplet go from long drips: it starts attached, so the goo stretches a neck before it snaps
        if (!reduced && grow > 0.85 && L > d.max * 0.8) {
          const free = drops.find((o) => o.d < 0);
          if (free && Math.random() < 0.03) {
            free.d = i;
            free.t0 = t;
            free.x = d.x;
            free.r = d.w * 0.55;
            free.el.style.width = free.el.style.height = `${free.r * 2}px`;
            free.el.style.background = holoAt(d.x / w);
          }
        }
      });
      for (const o of drops) {
        if (o.d < 0) continue;
        const d = drips[o.d]!;
        const age = t - o.t0;
        const tip = d.max * grow * 0.9 + 18 - o.r;
        const y = tip + 0.5 * 900 * age * age;
        if (y > h + 40) {
          o.d = -1;
          o.el.style.opacity = '0';
          continue;
        }
        o.el.style.opacity = '1';
        o.el.style.transform = `translate3d(${o.x - o.r}px, ${y}px, 0) scale(${1 - Math.min(0.25, age * 0.4)}, ${1 + Math.min(0.35, age * 0.8)})`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [sport]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[52vh] overflow-hidden">
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id="smadi-liquid" x="-5%" y="-5%" width="110%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11" result="goo" />
            <feGaussianBlur in="goo" stdDeviation="3.5" result="soft" />
            <feSpecularLighting in="soft" surfaceScale="7" specularConstant="1.15" specularExponent="26" lightingColor="#ffffff" result="spec">
              <feDistantLight azimuth="235" elevation="52" />
            </feSpecularLighting>
            <feComposite in="spec" in2="goo" operator="in" result="gloss" />
            <feComposite in="gloss" in2="goo" operator="arithmetic" k1="0" k2="0.85" k3="1" k4="0" />
          </filter>
        </defs>
      </svg>
      <div ref={wrap} className="absolute inset-0" style={{ filter: 'url(#smadi-liquid)' }}>
        <div className="absolute inset-x-0 top-0 h-[18px]" style={{ background: 'linear-gradient(90deg, #FF6A2B, #FFC53D 33%, #5EE7DF 66%, #8B5CF6)' }} />
      </div>
    </div>
  );
}
