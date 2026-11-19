import type Lenis from 'lenis';

/**
 * The page's smooth scroll (Lenis), shared so modal surfaces can hold the page still while they are
 * open. Null with reduced motion, on touch-only devices (they keep their native momentum) and on
 * the server.
 */
let instance: Lenis | null = null;
let holds = 0;

export const smoothScroll = {
  set(l: Lenis | null) {
    instance = l;
    if (l && holds > 0) l.stop();
  },
  get: () => instance,
  /** stop the page scrolling under a dialog; every hold() is paired with a release() */
  hold() {
    holds++;
    instance?.stop();
  },
  release() {
    holds = Math.max(0, holds - 1);
    if (!holds) instance?.start();
  },
};
