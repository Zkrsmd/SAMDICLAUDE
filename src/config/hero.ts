/**
 * Hero slides. Drop the AI videos into public/media/ and set `video` / `videoMobile`
 * (MP4, H.264). Until then the still `poster` is used, with motion added in CSS.
 */
export const heroSlides = [
  {
    id: 'football',
    word: 'Football',
    kicker: '01 — The strike',
    tagline: 'Built for every decisive moment.',
    cta: 'Explore football',
    href: '/football',
    product: { slug: 'adidas-f50-hyperfast-elite-fg-soccer-cleats', name: 'adidas F50 Hyperfast Elite FG' },
    poster: '/media/cat-football.webp',
    video: null as string | null,
    videoMobile: null as string | null,
    accent: '#FF6A2B',
    glow: 'rgba(255,106,43,0.55)',
  },
  {
    id: 'boxing',
    word: 'Boxing',
    kicker: '02 — The hook',
    tagline: 'Power in every round.',
    cta: 'Explore boxing',
    href: '/boxing',
    product: { slug: 'venum-giant-20-mike-tyson-pro-boxing-gloves-blackgold', name: 'Venum Giant 2.0 — Black/Gold' },
    poster: '/media/cat-boxing.webp',
    video: null as string | null,
    videoMobile: null as string | null,
    accent: '#E7B85A',
    glow: 'rgba(231,184,90,0.55)',
  },
  {
    id: 'swimming',
    word: 'Swimming',
    kicker: '03 — The fly',
    tagline: 'Move beyond your limits.',
    cta: 'Explore swimming',
    href: '/swimming',
    product: { slug: 'speedo-fastskin-speed-socket-20-mirrored-goggles-orangegold', name: 'Speedo Fastskin Speed Socket 2.0' },
    poster: '/media/cat-swimming.webp',
    video: null as string | null,
    videoMobile: null as string | null,
    accent: '#5EE7DF',
    glow: 'rgba(94,231,223,0.55)',
  },
] as const;

export type HeroSlide = (typeof heroSlides)[number];

/** Category card media (stills now; swap for looping videos later). */
export const categoryMedia: Record<string, string> = {
  football: '/media/cat-football.webp',
  boxing: '/media/cat-boxing.webp',
  swimming: '/media/cat-swimming.webp',
  running: '/media/cat-running.webp',
  fitness: '/media/cat-fitness.webp',
  basketball: '/media/cat-basketball.webp',
};
