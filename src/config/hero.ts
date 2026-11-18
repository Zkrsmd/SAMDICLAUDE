/**
 * Hero slides. Each slide plays a coded film (src/components/hero/cinema/scenes.ts) with the
 * same id — real product cut-outs choreographed in canvas, no video files needed.
 */
export const heroSlides = [
  {
    id: 'football',
    word: 'Football',
    kicker: 'The strike',
    tagline: 'Built for every decisive moment.',
    cta: 'Explore football',
    href: '/football',
    product: { slug: 'adidas-f50-hyperfast-elite-fg-soccer-cleats', brand: 'adidas', name: 'F50 Hyperfast Elite FG' },
    accent: '#4FAE3A',
  },
  {
    id: 'boxing',
    word: 'Boxing',
    kicker: 'The hook',
    tagline: 'Power in every round.',
    cta: 'Explore boxing',
    href: '/boxing',
    product: { slug: 'venum-giant-20-mike-tyson-pro-boxing-gloves-blackgold', brand: 'Venum', name: 'Giant 2.0 Mike Tyson Pro — Black/Gold' },
    accent: '#C99A3E',
  },
  {
    id: 'swimming',
    word: 'Swimming',
    kicker: 'The dive',
    tagline: 'Move beyond your limits.',
    cta: 'Explore swimming',
    href: '/swimming',
    product: { slug: 'speedo-fastskin-speed-socket-20-mirrored-goggles-orangegold', brand: 'Speedo', name: 'Fastskin Speed Socket 2.0 Mirrored' },
    accent: '#1FB5C9',
  },
  {
    id: 'basketball',
    word: 'Basketball',
    kicker: 'The bounce',
    tagline: 'Own the paint. Own the moment.',
    cta: 'Explore basketball',
    href: '/basketball',
    product: { slug: 'wilson-evolution-game-basketball', brand: 'Wilson', name: 'Evolution Game Basketball' },
    accent: '#E8792A',
  },
] as const;

export type HeroSlide = (typeof heroSlides)[number];
export const heroIds: string[] = heroSlides.map((s) => s.id);

/** Category card media (owner-supplied AI stills; swap for looping videos later). */
export const categoryMedia: Record<string, string> = {
  football: '/media/cat-football.webp',
  boxing: '/media/cat-boxing.webp',
  swimming: '/media/cat-swimming.webp',
  running: '/media/cat-running.webp',
  fitness: '/media/cat-fitness.webp',
  basketball: '/media/cat-basketball.webp',
};
