'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Site-wide effects: scroll reveals for every [data-reveal] element (including ones rendered
 * later) and a soft cursor spotlight on desktop. Pure DOM — no React state per frame.
 */
export function Effects() {
  const pathname = usePathname();

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    // reveal anything that has entered (or been scrolled past) the lower 92% of the viewport
    const check = () => {
      raf = 0;
      const limit = window.innerHeight * 0.92;
      document.querySelectorAll('[data-reveal]:not(.in)').forEach((el) => {
        if (reduced || el.getBoundingClientRect().top < limit) el.classList.add('in');
      });
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    const mo = new MutationObserver(queue);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
    };
  }, [pathname]);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const root = document.documentElement;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.style.setProperty('--mx', `${e.clientX}px`);
        root.style.setProperty('--my', `${e.clientY}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // light-up cards follow the cursor; tilt plates lean towards it
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-light],[data-tilt]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--cx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--cy', `${(y * 100).toFixed(1)}%`);
      if (el.hasAttribute('data-tilt') && !reduced) {
        el.style.setProperty('--ry', `${((x - 0.5) * 10).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - y) * 8).toFixed(2)}deg`);
        el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      }
    };
    const onOut = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tilt]');
      if (el && !el.contains(e.relatedTarget as Node)) {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      }
    };
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    if (fine) {
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointerout', onOut, { passive: true });
    } else {
      // touch: a card lights up while it sits in the middle of the screen
      io = new IntersectionObserver((es) => es.forEach((en) => en.target.classList.toggle('lit', en.isIntersecting)), { rootMargin: '-38% 0px -38% 0px' });
      const scan = () => document.querySelectorAll('[data-light]').forEach((el) => io!.observe(el));
      scan();
      mo = new MutationObserver(scan);
      mo.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      io?.disconnect();
      mo?.disconnect();
    };
  }, [pathname]);

  return <div aria-hidden className="spotlight" />;
}
