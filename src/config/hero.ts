/**
 * Hero slides (the banner): a full-screen film each, with the name over it in big white,
 * see-through type — the name opens the page. In this order (owner's choice): Football,
 * Sportswear, Martial arts (boxing included), Fitness (gym), Swimming, Competition (basketball,
 * volleyball, handball), Diving. Sportswear, Martial arts and Competition open the pages that gather
 * several sports (src/config/worlds.ts). Each film exists in two shapes — landscape for desktop,
 * portrait for phones — with a poster still; football, martial arts, fitness and diving are the
 * owner's clips used whole (scripts/full-films.mjs), the others short edits (scripts/edit-films.mjs).
 * Films loop. Sources and rights: public/video/CREDITS.md.
 */
export const heroSlides = [
  { id: 'football', film: 'football', word: 'Football', cta: 'Explore football', href: '/football' },
  { id: 'sportswear', film: 'sportswear', word: 'Sportswear', cta: 'Explore sportswear', href: '/sportswear' },
  { id: 'martial-arts', film: 'martial-arts', word: 'Martial arts', cta: 'Explore martial arts', href: '/combat-sports' },
  { id: 'fitness', film: 'fitness', word: 'Fitness', cta: 'Explore fitness', href: '/fitness' },
  { id: 'swimming', film: 'swimming', word: 'Swimming', cta: 'Explore swimming', href: '/swimming' },
  { id: 'competition', film: 'basketball', word: 'Competition', cta: 'Explore competition sports', href: '/competition' },
  { id: 'diving', film: 'diving', word: 'Diving', cta: 'Explore diving', href: '/diving' },
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
  diving: '/video/diving.webp',
  volleyball: '/video/basketball.webp',
};
