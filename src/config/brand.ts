/**
 * Central brand configuration. The final brand name has not been chosen —
 * change it here and it updates everywhere (wordmark, metadata, footer, loader).
 */
export const brand = {
  name: 'YOUR BRAND',
  /** Short form used in tight spaces (mobile header, favicon text). */
  shortName: 'YB',
  tagline: 'Equipment for every decisive moment.',
  description:
    'A curated sports equipment store for football, boxing, swimming and more — presented like a showroom, shopped like a store.',
  contact: {
    email: 'hello@example.com',
    phone: '+00 000 000 000',
    address: 'Street address placeholder, City, Country',
  },
  social: [
    { label: 'Instagram', href: 'https://instagram.com/' },
    { label: 'TikTok', href: 'https://tiktok.com/' },
    { label: 'YouTube', href: 'https://youtube.com/' },
  ],
  colors: {
    bg: '#FAFAF7',
    surface: '#FFFFFF',
    stone: '#EFEEE8',
    grey: '#E1E3DE',
    ink: '#171A18',
    muted: '#747B76',
    grass: '#89C94A',
    orange: '#F36A32',
    gold: '#C8A451',
    aqua: '#64D7D1',
    blue: '#218FB0',
  },
  commerce: {
    currency: 'EUR',
    locale: 'en-IE',
    /** The checkout is a demonstration until a real payment provider is integrated. */
    demoCheckout: true,
    freeShippingThresholdCents: null as number | null,
  },
} as const;

export type Brand = typeof brand;
