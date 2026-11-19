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
  { id: 'basketball', word: 'Basketball', cta: 'Explore basketball', href: '/basketball' },
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

/** The product that stands on each sport's arena card on the homepage. */
export const arenaPicks: Record<string, string> = {
  football: 'adidas-predator-elite-fg-soccer-cleats-white',
  boxing: 'everlast-powerlock-og-pro-training-glove-lace-up',
  swimming: 'speedo-fastskin-speed-socket-20-mirrored-goggles-smokeblue',
  basketball: 'nike-lebron-xxiv-stars-basketball-shoes',
  running: 'nike-apex-road-racing-shoes',
  fitness: 'everlast-1910-pro-leather-medicine-ball',
};

/** Category page header media (owner-supplied AI stills; swap for looping videos later). */
export const categoryMedia: Record<string, string> = {
  football: '/media/cat-football.webp',
  boxing: '/media/cat-boxing.webp',
  swimming: '/media/cat-swimming.webp',
  running: '/media/cat-running.webp',
  fitness: '/media/cat-fitness.webp',
  basketball: '/media/cat-basketball.webp',
};
