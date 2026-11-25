/**
 * How the floating header (src/components/header/Header.tsx) knows what is under it, so the STRYKE
 * letters and the bag icon stay readable: bone white on dark, deep navy on light.
 *
 * - A surface can say it: `data-header-tone="dark" | "light"`, plus `data-header-busy` when it is a
 *   photo or a film (the header then keeps one steady colour for it and adds a soft shadow, instead
 *   of reacting to every frame). Without it, the header reads the surface's background colour.
 * - The hero banner also has `data-header-wipe`: when its slide changes it sends HERO_WIPE_EVENT
 *   and the header's colour change follows the slide's edge across the letters.
 */
export type HeaderTone = 'light' | 'dark';

export interface HeroWipeDetail {
  from: HeaderTone;
  to: HeaderTone;
  /** 1: the new slide comes in from the right edge (next), -1: from the left (previous) */
  dir: 1 | -1;
}

export const HERO_WIPE_EVENT = 'stryke:hero-wipe';
