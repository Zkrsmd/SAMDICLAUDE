/**
 * Hero slides: one full-screen film per sport, with the sport's name over it in big white,
 * see-through type. The films are cut by scripts/edit-films.mjs in two shapes — landscape for
 * desktop and portrait for phones — each with a poster still (shown until the film plays, and
 * instead of it with reduced motion). Sources and rights are listed in public/video/CREDITS.md.
 */
export const heroSlides = [
  { id: 'football', word: 'Football', cta: 'Explore football', href: '/football' },
  { id: 'boxing', word: 'Boxing', cta: 'Explore boxing', href: '/boxing' },
  { id: 'swimming', word: 'Swimming', cta: 'Explore swimming', href: '/swimming' },
  { id: 'fitness', word: 'Fitness', cta: 'Explore fitness', href: '/fitness' },
  { id: 'martial-arts', word: 'Martial arts', cta: 'Explore martial arts', href: '/martial-arts' },
  { id: 'basketball', word: 'Basketball', cta: 'Explore basketball', href: '/basketball' },
  { id: 'fishing', word: 'Fishing', cta: 'Explore fishing', href: '/fishing' },
] as const;

export type HeroSlide = (typeof heroSlides)[number];

/** the film files for a slide: landscape + portrait (phones), each with its poster */
export const heroFilm = (id: string) => ({
  wide: `/video/${id}.mp4`,
  wideStill: `/video/${id}.webp`,
  tall: `/video/${id}-p.mp4`,
  tallStill: `/video/${id}-p.webp`,
});

/** screens at least this tall for their width get the portrait cut */
export const HERO_TALL_QUERY = '(max-aspect-ratio: 4/5)';

/** The cut-out that stands for each sport in the homepage "Pick your sport" circles. */
export const sportIcons: Record<string, string> = {
  football: 'world-cup-2026-ball',
  boxing: 'venum-boxing-gloves-black-gold',
  'martial-arts': 'karate-suit-white',
  swimming: 'nabaiji-swim-goggles',
  diving: 'beuchat-diving-mask',
  pool: 'bestway-family-pool',
  fishing: 'fishing-reel-crossfire-lt-700',
  fitness: 'chrome-dumbbell-set',
  recovery: 'knee-support-9520',
  running: 'asics-running-shoes',
  basketball: 'molten-bg4500-fiba-basketball',
  volleyball: 'mikasa-volleyball',
  racket: 'table-tennis-set-bats-and-balls',
  fan: 'algeria-flag-giant',
  outdoor: 'monster-energy-moto-gloves',
};

/** Category page header media (owner-supplied AI stills; swap for looping videos later). */
export const categoryMedia: Record<string, string> = {
  football: '/media/cat-football.webp',
  boxing: '/media/cat-boxing.webp',
  swimming: '/media/cat-swimming.webp',
  running: '/media/cat-running.webp',
  fitness: '/media/cat-fitness.webp',
  basketball: '/media/cat-basketball.webp',
  // the hero films' stills
  'martial-arts': '/video/martial-arts.webp',
  fishing: '/video/fishing.webp',
};
