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
    // reveal anything that has entered (or been scrolled past) the lower 92% of the viewport —
    // the browser reports it; nothing is measured while scrolling
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (reduced || e.isIntersecting || e.boundingClientRect.top < 0) {
            const el = e.target as HTMLElement;
            el.classList.add('in');
            io.unobserve(el);
            const delay = parseFloat(getComputedStyle(el).transitionDelay) || 0;
            window.setTimeout(() => el.setAttribute('data-settled', ''), 1300 + delay * 1000);
          }
        }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    const check = () => {
      raf = 0;
      document.querySelectorAll('[data-reveal]:not(.in):not([data-io])').forEach((el) => {
        el.setAttribute('data-io', '');
        io.observe(el);
      });
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    // only new elements can bring new [data-reveal]s; text updates (HUD readouts, counters) must not force layout
    const mo = new MutationObserver((ms) => {
      if (ms.some((m) => Array.from(m.addedNodes).some((n) => n.nodeType === 1))) queue();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      io.disconnect();
      document.querySelectorAll('[data-io]').forEach((el) => el.removeAttribute('data-io'));
    };
  }, [pathname]);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let spot: HTMLElement | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // move the glow itself (compositor transform) — setting variables on <html> restyled the whole page
        spot ??= document.querySelector<HTMLElement>('.spotlight');
        if (spot) spot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  // while the page is actively scrolling, cards sliding under a resting cursor don't start their hover
  // animations (big animated shadows, zooms); hover works again the moment scrolling stops
  useEffect(() => {
    const root = document.documentElement;
    let t = 0;
    const onScroll = () => {
      if (!t) root.classList.add('is-scrolling');
      else window.clearTimeout(t);
      t = window.setTimeout(() => {
        root.classList.remove('is-scrolling');
        t = 0;
      }, 160);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(t);
      root.classList.remove('is-scrolling');
    };
  }, []);

  // magnetic controls lean a few pixels toward the cursor (CSS `translate`, so hover transforms still apply)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let active: HTMLElement | null = null;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-magnetic]') ?? null;
      if (active && active !== el) active.style.translate = '';
      active = el;
      if (!el) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = ((e.clientX - r.left) / r.width - 0.5) * Math.min(14, r.width * 0.12);
        const dy = ((e.clientY - r.top) / r.height - 0.5) * Math.min(10, r.height * 0.2);
        el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
      });
    };
    const onOut = (e: PointerEvent) => {
      if (active && !active.contains(e.relatedTarget as Node | null)) {
        active.style.translate = '';
        active = null;
      }
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
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
