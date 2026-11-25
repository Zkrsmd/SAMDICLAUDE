import { smoothScroll } from './smooth-scroll';

/**
 * Bring a field the customer must fix back on screen (centred), then put the focus in it — used
 * when an order can't be sent: a missing size, a wrong phone number… Smooth unless the visitor
 * prefers reduced motion. `shake` replays a short attention nudge on the element.
 */
/**
 * Glide down so `el`'s top sits `gap` px below the top of the screen — never up (if it's already
 * there or above, nothing moves). Used to bring the product page's order form into view.
 */
export function scrollDownTo(el: HTMLElement | null, gap = 84) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = window.scrollY + el.getBoundingClientRect().top - gap;
  if (target <= window.scrollY + 8) return;
  const lenis = smoothScroll.get();
  if (lenis) lenis.scrollTo(target, { immediate: reduce, duration: 1.1 });
  else window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
}

export function goToField(el: HTMLElement | null, focus: HTMLElement | null = el) {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lenis = smoothScroll.get();
  const r = el.getBoundingClientRect();
  const target = window.scrollY + r.top - Math.max(96, (window.innerHeight - r.height) / 2);
  if (lenis) lenis.scrollTo(Math.max(0, target), { immediate: reduce });
  else window.scrollTo({ top: Math.max(0, target), behavior: reduce ? 'auto' : 'smooth' });
  window.setTimeout(() => focus?.focus({ preventScroll: true }), reduce ? 0 : 450);
  if (!reduce) {
    el.classList.remove('field-nudge');
    void el.offsetWidth; // restart the animation
    el.classList.add('field-nudge');
  }
}
