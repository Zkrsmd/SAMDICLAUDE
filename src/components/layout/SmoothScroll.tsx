'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { smoothScroll } from '@/lib/smooth-scroll';

/**
 * Smooth, weighted wheel scrolling for the whole site (Lenis): the page glides to where the wheel
 * sends it instead of stepping. The page still scrolls natively (sticky, scroll timelines, focus and
 * find-in-page all work); touch keeps the device's own momentum, and it is off with reduced motion.
 * Dialogs and anything marked data-lenis-prevent scroll on their own.
 */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    let alive = true;
    let lenis: import('lenis').default | null = null;
    void import('lenis').then(({ default: Lenis }) => {
      if (!alive) return;
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.085,
        wheelMultiplier: 0.95,
        // a horizontal rail or an inner list scrolls itself when the wheel/trackpad is aimed at it
        allowNestedScroll: true,
        // scrollable surfaces (drawers, sheets, overlays, rails) keep their own wheel
        prevent: (node) => !!(node as HTMLElement).closest?.('[role="dialog"],[data-lenis-prevent]'),
      });
      smoothScroll.set(lenis);
    });
    return () => {
      alive = false;
      smoothScroll.set(null);
      lenis?.destroy();
    };
  }, []);

  // a new page starts where the router put it, without gliding there from the old position
  useEffect(() => {
    smoothScroll.get()?.scrollTo(window.scrollY, { immediate: true, force: true });
  }, [pathname]);

  return null;
}
