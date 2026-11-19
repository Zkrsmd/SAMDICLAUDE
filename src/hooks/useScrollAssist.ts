'use client';
import { useEffect, useRef } from 'react';

/**
 * Scroll assist for scroll-scrubbed animations. Inside an animated stretch of the page (between the
 * first and last resting point), when the visitor scrolls a little and lets go, the page glides on to
 * the next resting point in the direction they were going — so a transition never stalls half-way.
 *
 * Never a hijack: no wheel/touch is blocked, any input (wheel, touch, key, pointer) cancels the glide
 * at once, outside the stretch nothing happens, and it is off with prefers-reduced-motion. It only
 * answers the visitor's own scrolling (wheel, touch, keys): scrolls the page makes by itself (focus,
 * anchors, scrollIntoView, automation) never start a glide.
 *
 * `points` returns document-y resting points (read on demand, cached by the caller as it likes).
 */
export function useScrollAssist(points: () => number[] | null, opts: { idle?: number } = {}) {
  const get = useRef(points);
  get.current = points;
  const idleMs = opts.idle ?? 140;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let lastY = window.scrollY;
    let dir = 0;
    let idle = 0;
    let raf = 0;
    let gliding = false;
    let selfScroll = false;
    let touching = false;
    /** when the visitor last scrolled by hand */
    let intent = -1e9;

    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const cancel = () => {
      if (!gliding) return;
      gliding = false;
      cancelAnimationFrame(raf);
    };
    const glide = (to: number) => {
      const from = window.scrollY;
      const dist = to - from;
      if (Math.abs(dist) < 2) return;
      const dur = Math.min(1500, Math.max(650, Math.abs(dist) * 0.9));
      const t0 = performance.now();
      gliding = true;
      const step = (now: number) => {
        if (!gliding) return;
        const k = Math.min(1, (now - t0) / dur);
        selfScroll = true;
        window.scrollTo({ top: from + dist * ease(k), behavior: 'instant' as ScrollBehavior });
        if (k < 1) raf = requestAnimationFrame(step);
        else gliding = false;
      };
      raf = requestAnimationFrame(step);
    };

    const settle = () => {
      if (touching || gliding) return;
      if (performance.now() - intent > 1500) return;
      const pts = get.current();
      if (!pts || pts.length < 2) return;
      const sorted = [...pts].sort((a, b) => a - b);
      const y = window.scrollY;
      const lo = sorted[0]!;
      const hi = sorted[sorted.length - 1]!;
      if (y <= lo + 4 || y >= hi - 4) return; // outside (or at the ends of) the animated stretch
      if (sorted.some((p) => Math.abs(p - y) < 6)) return; // already resting
      const target = dir >= 0 ? sorted.find((p) => p > y) : [...sorted].reverse().find((p) => p < y);
      if (target !== undefined) glide(target);
    };

    const onScroll = () => {
      const y = window.scrollY;
      if (selfScroll) {
        selfScroll = false;
        lastY = y;
        return;
      }
      if (y !== lastY) dir = Math.sign(y - lastY);
      lastY = y;
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, idleMs);
    };
    const onInput = () => {
      intent = performance.now();
      cancel();
      window.clearTimeout(idle);
    };
    const onTouchStart = () => {
      touching = true;
      onInput();
    };
    const onTouchEnd = () => {
      touching = false;
      intent = performance.now();
      // momentum scrolling keeps firing scroll events; settle runs once it really stops
      window.clearTimeout(idle);
      idle = window.setTimeout(settle, idleMs + 80);
    };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) onInput();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onInput, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    // a click or tap stops a glide but is not a scroll gesture
    const onPointer = () => cancel();
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      cancel();
      window.clearTimeout(idle);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onInput);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [idleMs]);
}
