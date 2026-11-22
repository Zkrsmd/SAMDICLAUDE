/**
 * Central brand configuration: change the name here and it updates everywhere (metadata, footer…).
 * The logo lock-up itself is src/components/ui/Wordmark.tsx.
 */
export const brand = {
  name: 'REVO',
  /** Short form used in tight spaces (mobile header, favicon text). */
  shortName: 'RV',
  tagline: 'Gear for every decisive moment.',
  description:
    'REVO is an online sports store in Algeria: football jerseys, boxing gloves, swimming, fitness, martial arts, basketball and fishing gear. Prices in DA, cash on delivery to all 58 wilayas.',
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
    bg: '#F3F4F6',
    surface: '#FFFFFF',
    stone: '#E8EBEF',
    grey: '#D9DDE3',
    ink: '#0F1216',
    muted: '#66707C',
    cobalt: '#2B59FF',
    steel: '#8E99A8',
    grass: '#89C94A',
    orange: '#F36A32',
    gold: '#C8A451',
    aqua: '#64D7D1',
    blue: '#218FB0',
  },
  commerce: {
    /** Algerian dinars; amounts are kept in centimes (DA × 100) everywhere, like cents. */
    currency: 'DZD',
    /** Cash on delivery only, Algeria only. */
    country: 'DZ',
    /** The demo catalogue came with US list prices: they are shown converted at this rate (DA per $),
     *  rounded to 100 DA. Real prices are set per product in the admin. */
    demoUsdRate: 250,
    /** What the customer is told after ordering. */
    confirmCall: 'within about an hour',
  },
} as const;

export type Brand = typeof brand;
