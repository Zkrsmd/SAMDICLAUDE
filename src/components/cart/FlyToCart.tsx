'use client';
import { useEffect, useRef } from 'react';
import { useUi } from '@/stores/ui';

const SIZE = 120;
/** points along a curved arc from a to b (a quadratic Bézier lifted above both ends) */
function arc(ax: number, ay: number, bx: number, by: number, steps: number) {
  const cx = ax + (bx - ax) * 0.35;
  const cy = Math.min(ay, by) - Math.max(140, Math.abs(bx - ax) * 0.25);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return { t, x: u * u * ax + 2 * u * t * cx + t * t * bx, y: u * u * ay + 2 * u * t * cy + t * t * by };
  });
}

/**
 * Adding to the bag: the product flies on an arc into the header bag with a fading trail, shrinking
 * and spinning a little; the bag swallows it (a squash and bounce), a cobalt ring bursts out and a
 * "+1" rises. Transforms and opacity only (Web Animations API); with reduced motion only the bag pulses.
 */
export function FlyToCart() {
  const flyFrom = useUi((s) => s.flyFrom);
  const set = useUi((s) => s.set);
  const main = useRef<HTMLImageElement>(null);
  const ghosts = useRef<(HTMLImageElement | null)[]>([]);
  const ring = useRef<HTMLSpanElement>(null);
  const plus = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!flyFrom) return;
    const btn = document.getElementById('cart-button');
    const target = btn?.getBoundingClientRect();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const anims: Animation[] = [];
    const land = () => {
      set({ flyFrom: null });
      if (!btn || !target) return;
      anims.push(
        btn.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(0.78, 0.86)', offset: 0.25 },
            { transform: 'scale(1.2)', offset: 0.55 },
            { transform: 'scale(0.96)', offset: 0.8 },
            { transform: 'scale(1)' },
          ],
          { duration: reduced ? 1 : 560, easing: 'ease-out' },
        ),
      );
      if (reduced) return;
      const cx = target.left + target.width / 2;
      const cy = target.top + target.height / 2;
      const r = ring.current;
      if (r) {
        r.style.left = `${cx}px`;
        r.style.top = `${cy}px`;
        anims.push(
          r.animate(
            [
              { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.9 },
              { transform: 'translate(-50%, -50%) scale(2.1)', opacity: 0 },
            ],
            { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' },
          ),
        );
      }
      const p = plus.current;
      if (p) {
        p.textContent = `+${Math.max(1, flyFrom.n ?? 1)}`;
        p.style.left = `${cx}px`;
        p.style.top = `${target.bottom}px`;
        anims.push(
          p.animate(
            [
              { transform: 'translate(-50%, 0) scale(0.6)', opacity: 0 },
              { transform: 'translate(-50%, 8px) scale(1.1)', opacity: 1, offset: 0.3 },
              { transform: 'translate(-50%, 22px) scale(1)', opacity: 0 },
            ],
            { duration: 900, easing: 'ease-out' },
          ),
        );
      }
    };

    if (!target || reduced || !main.current) {
      land();
      return () => anims.forEach((a) => a.cancel());
    }
    const bx = target.left + target.width / 2;
    const by = target.top + target.height / 2;
    const pts = arc(flyFrom.x, flyFrom.y, bx, by, 18);
    const frames = (shrink: number) =>
      pts.map(({ t, x, y }) => ({
        transform: `translate3d(${(x - SIZE / 2).toFixed(1)}px, ${(y - SIZE / 2).toFixed(1)}px, 0) rotate(${(-28 * Math.sin(t * Math.PI) + 12 * t).toFixed(1)}deg) scale(${(1 - (1 - shrink) * t * t).toFixed(3)})`,
        opacity: t > 0.92 ? (1 - t) / 0.08 : 1,
        offset: t,
      }));
    const timing = { duration: 720, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both' as const };
    const imgs = [main.current, ...ghosts.current].filter(Boolean) as HTMLImageElement[];
    imgs.forEach((img, i) => {
      img.src = flyFrom.src;
      const a = img.animate(frames(0.14 + i * 0.02), { ...timing, delay: i * 55 });
      anims.push(a);
      if (i === 0) a.onfinish = land;
    });
    return () => anims.forEach((a) => a.cancel());
  }, [flyFrom, set]);

  const shown = flyFrom ? 'block' : 'none';
  return (
    <>
      {[0.35, 0.16].map((o, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          ref={(el) => {
            ghosts.current[i] = el;
          }}
          alt=""
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[89] object-contain"
          style={{ display: shown, width: SIZE, height: SIZE, opacity: o, filter: 'saturate(0.6)' }}
        />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={main}
        alt=""
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[90] object-contain drop-shadow-[0_12px_14px_rgba(15,20,30,0.28)]"
        style={{ display: shown, width: SIZE, height: SIZE }}
      />
      <span ref={ring} aria-hidden className="fly-ring" />
      <span ref={plus} aria-hidden className="fly-plus" />
    </>
  );
}
