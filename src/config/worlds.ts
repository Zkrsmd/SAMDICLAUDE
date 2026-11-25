/**
 * "Worlds": pages that gather several sports or categories under one name, opened from the hero
 * banner (src/config/hero.ts) — Sportswear (clothing from every sport), Martial arts (boxing and the
 * martial arts together) and Competition (basketball, volleyball and handball). They live at
 * /<slug> next to the sport pages ([sport]/page.tsx) and list every product of their parts, with a
 * tile per category. A part is a whole sport ("boxing") or one category ("football/jerseys").
 */
export interface World {
  slug: string;
  name: string;
  description: string;
  /** whole sports or "sport/category" */
  parts: string[];
  /** the header still */
  media: string;
}

export const worlds: World[] = [
  {
    slug: 'sportswear',
    name: 'Sportswear',
    description: 'Jerseys, tracksuits, sets, caps and training wear from every sport.',
    parts: ['football/jerseys', 'football/tracksuits', 'football/kits', 'fitness/apparel', 'boxing/apparel', 'basketball/apparel', 'fan/caps', 'football/socks'],
    media: '/video/sportswear.webp',
  },
  {
    slug: 'combat-sports',
    name: 'Martial arts',
    description: 'Boxing, kickboxing, MMA, judo, karate and kung fu: gloves, suits, pads, bags and protection.',
    parts: ['boxing', 'martial-arts'],
    media: '/video/martial-arts.webp',
  },
  {
    slug: 'competition',
    name: 'Competition',
    description: 'Basketball, volleyball and handball: balls, nets and match wear.',
    parts: ['basketball', 'volleyball'],
    media: '/video/basketball.webp',
  },
];

export const getWorld = (slug: string) => worlds.find((w) => w.slug === slug);
