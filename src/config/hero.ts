/** Copy and styling for the three cinematic hero scenes (order matches the 3D engine). */
export const heroSlides = [
  {
    id: 'football',
    word: 'Football',
    tagline: 'Built for every decisive moment.',
    cta: 'Explore football',
    href: '/football',
    product: { slug: 'adidas-f50-elite-fg-coral-blaze', color: 'coral-blaze', name: 'adidas F50 Elite FG “Coral Blaze”' },
    accent: '#89C94A',
    poster: 'linear-gradient(180deg,#CFE2F0 0%,#F4EEDF 52%,#7FB34A 52.2%,#5C9A33 100%)',
    swatch: '#F36A32',
  },
  {
    id: 'boxing',
    word: 'Boxing',
    tagline: 'Power in every round.',
    cta: 'Explore boxing',
    href: '/boxing',
    product: { slug: 'venum-power-2-boxing-gloves-black-gold', color: 'black-gold', name: 'Venum Power 2.0 — Black/Gold' },
    accent: '#C8A451',
    poster: 'linear-gradient(180deg,#FBFAF6 0%,#EFEBE2 60%,#DCD7CC 60.2%,#CFC9BC 100%)',
    swatch: '#C8A451',
  },
  {
    id: 'swimming',
    word: 'Swimming',
    tagline: 'Move beyond your limits.',
    cta: 'Explore swimming',
    href: '/swimming',
    product: { slug: 'speedo-fastskin-pure-focus-mirror-goggles', color: 'gold-mirror', name: 'Speedo Fastskin Pure Focus Mirror' },
    accent: '#64D7D1',
    poster: 'linear-gradient(180deg,#EDF7F7 0%,#DDF2F2 50%,#6FDCE0 50.2%,#2AA7B8 100%)',
    swatch: '#218FB0',
  },
] as const;

export type HeroSlide = (typeof heroSlides)[number];
