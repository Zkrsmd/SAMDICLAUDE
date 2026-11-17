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

  return <div aria-hidden className="spotlight" />;
}
