/**
 * Hero slides. Each slide is a three.js world with the same id (src/components/hero/crystal):
 * the real product cut-out breaks out of its own crystal.
 */
export const heroSlides = [
  {
    id: 'football',
    word: 'Football',
    kicker: 'The strike',
    tagline: 'Built for every decisive moment.',
    cta: 'Explore football',
    href: '/football',
    product: { slug: 'nike-mercurial-vapor-17-elite-vini-jr-fg', brand: 'Nike', name: 'Mercurial Vapor 17 Elite FG' },
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
    product: { slug: 'wilson-2026-nba-finals-championship-basketball-new-york-knicks', brand: 'Wilson', name: 'NBA Finals Championship Ball' },
    accent: '#E8792A',
  },
] as const;

export type HeroSlide = (typeof heroSlides)[number];
export const heroIds: string[] = heroSlides.map((s) => s.id);

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
