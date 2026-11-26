import { smoothScroll } from './smooth-scroll';

/**
 * Scroll the page smoothly to `top` (instantly with reduced motion). The smooth scroller (Lenis) is
 * first told where the page really is: a jump it missed — the browser bringing a tapped button into
 * view while the page is still starting, say — would leave it thinking it is "already there", and it
 * would not move at all. (That sync is a no-op jump to the current position.)
 */
function glide(top: number, reduce: boolean, duration?: number) {
  const lenis = smoothScroll.get();
  if (!lenis) {
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    return;
  }
  if (Math.abs(lenis.animatedScroll - window.scrollY) > 2) lenis.scrollTo(window.scrollY, { immediate: true, force: true });
  lenis.scrollTo(top, { immediate: reduce, ...(duration ? { duration } : {}) });
}

/**
 * Glide down so `el`'s top sits `gap` px below the top of the screen — never up (if it's already
 * there or above, nothing moves). Used to bring the product page's order form into view.
 */
export function scrollDownTo(el: HTMLElement | null, gap = 84) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = window.scrollY + el.getBoundingClientRect().top - gap;
  if (target <= window.scrollY + 8) return;
  glide(target, reduce, 1.1);
}

/**
 * Bring a field the customer must fix back on screen (centred), then put the focus in it — used
 * when an order can't be sent: a missing size, a wrong phone number… Smooth unless the visitor
 * prefers reduced motion; a short attention nudge plays on the element.
 */
export function goToField(el: HTMLElement | null, focus: HTMLElement | null = el) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r = el.getBoundingClientRect();
  const target = window.scrollY + r.top - Math.max(96, (window.innerHeight - r.height) / 2);
  glide(Math.max(0, target), reduce);
  window.setTimeout(() => focus?.focus({ preventScroll: true }), reduce ? 0 : 450);
  if (!reduce) {
    el.classList.remove('field-nudge');
    void el.offsetWidth; // restart the animation
    el.classList.add('field-nudge');
  }
}
