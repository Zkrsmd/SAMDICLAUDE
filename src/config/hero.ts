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

/**
 * Background film per sport: the whole backdrop of its 3D world, full screen behind the crystal
 * (cool-graded, under the sport word). Files live in /public/video and must be licensed for commercial use; the poster is a still
 * of the clip, shown until the video plays (and instead of it with reduced motion).
 */
export const heroMedia: Partial<Record<string, { video: string; poster: string; credit: string }>> = {
  football: { video: '/video/football.mp4', poster: '/video/football.webp', credit: 'Pexels video 30147551 (Pexels License)' },
  boxing: { video: '/video/boxing.mp4', poster: '/video/boxing.webp', credit: 'Pexels video 4761738 (Pexels License)' },
  swimming: { video: '/video/swimming.mp4', poster: '/video/swimming.webp', credit: 'Pexels video 6539698 (Pexels License)' },
  basketball: { video: '/video/basketball.mp4', poster: '/video/basketball.webp', credit: 'Pexels video 12787247 (Pexels License)' },
};
export const heroIds: string[] = heroSlides.map((s) => s.id);

/**
 * The crew: more of the sport's real products that burst out of the crystal with the hero product
 * and hang around it in depth (real cut-outs, like the hero product — never models).
 */
export const heroCrew: Record<string, { slug: string; w: number }[]> = {
  football: [
    { slug: 'adidas-predator-elite-fg-soccer-cleats-white', w: 1.15 },
    { slug: 'puma-stellar-match-laliga-fifa-quality-soccer-ball', w: 0.72 },
    { slug: 'adidas-f50-hyperfast-elite-fg-soccer-cleats', w: 1.1 },
  ],
  boxing: [
    { slug: 'everlast-powerlock-og-pro-training-glove-lace-up', w: 0.85 },
    { slug: 'everlast-elite-2-headgear', w: 0.8 },
    { slug: 'everlast-elite-handwraps-white-180in', w: 0.78 },
  ],
  swimming: [
    { slug: 'speedo-fastskin-cap-blackwhite', w: 0.75 },
    { slug: 'arena-cobra-ultra-swipe-mirror-goggles', w: 0.95 },
    { slug: 'speedo-dmc-super-fin-bluegrey', w: 0.9 },
  ],
  basketball: [
    { slug: 'nike-lebron-xxiv-stars-basketball-shoes', w: 1.15 },
    { slug: 'wilson-2026-evo-editions-hyper-pop-basketball', w: 0.72 },
    { slug: 'nike-ja-4-code-red-basketball-shoes', w: 1.1 },
  ],
};

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
