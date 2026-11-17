import type { Sport, SportSlug } from '@/types/catalog';

export const sports: Sport[] = [
  {
    slug: 'football',
    name: 'Football',
    tier: 'major',
    tagline: 'Built for every decisive moment.',
    description:
      'Boots, balls and kit for the pitch — from speed boots built for the final third to the socks and shin guards that finish the kit.',
    accent: '#89C94A',
    accentSoft: '#E6F2D6',
    subs: [
      { slug: 'boots', name: 'Football boots', blurb: 'Speed, control and touch — on the wall.', showroom: 'wall' },
      { slug: 'balls', name: 'Football balls', blurb: 'Match and training balls.' },
      { slug: 'jerseys', name: 'Jerseys', blurb: 'Match-day and training jerseys.' },
      { slug: 'shorts', name: 'Shorts', blurb: 'Lightweight match shorts.' },
      { slug: 'socks', name: 'Socks', blurb: 'Grip socks and match socks.' },
      { slug: 'shin-guards', name: 'Shin guards', blurb: 'Low-profile protection.' },
      { slug: 'training', name: 'Training equipment', blurb: 'Cones, markers and drills.' },
      { slug: 'accessories', name: 'Accessories', blurb: 'Bottles, bags and more.' },
    ],
  },
  {
    slug: 'boxing',
    name: 'Boxing',
    tier: 'major',
    tagline: 'Power in every round.',
    description:
      'Gloves, wraps and bags for every round — from the first pad session to fight camp.',
    accent: '#C8A451',
    accentSoft: '#F3ECDC',
    subs: [
      { slug: 'gloves', name: 'Boxing gloves', blurb: 'Hung on the wall like trophies.', showroom: 'hooks' },
      { slug: 'hand-wraps', name: 'Hand wraps', blurb: 'The first layer of protection.' },
      { slug: 'punching-bags', name: 'Punching bags', blurb: 'Heavy bags for power work.' },
      { slug: 'head-protection', name: 'Head protection', blurb: 'Sparring headgear.' },
      { slug: 'mouthguards', name: 'Mouthguards', blurb: 'Mouldable guards.' },
      { slug: 'training', name: 'Training equipment', blurb: 'Ropes and pads.' },
      { slug: 'apparel', name: 'Apparel', blurb: 'Fight shorts and training wear.' },
      { slug: 'accessories', name: 'Accessories', blurb: 'Bags and essentials.' },
    ],
  },
  {
    slug: 'swimming',
    name: 'Swimming',
    tier: 'major',
    tagline: 'Move beyond your limits.',
    description:
      'Racing goggles, caps and swimwear — plus the fins, boards and buoys that build the engine behind them.',
    accent: '#64D7D1',
    accentSoft: '#DDF4F2',
    subs: [
      { slug: 'goggles', name: 'Swimming goggles', blurb: 'Mirror lenses on glass plinths.', showroom: 'plinths' },
      { slug: 'caps', name: 'Swimming caps', blurb: 'Silicone racing and training caps.' },
      { slug: 'swimsuits', name: 'Swimsuits', blurb: 'Training and racing suits.' },
      { slug: 'swim-shorts', name: 'Swimming shorts', blurb: 'Jammers and swim shorts.' },
      { slug: 'fins', name: 'Fins', blurb: 'Short-blade training fins.' },
      { slug: 'kickboards', name: 'Kickboards', blurb: 'Leg-focused training.' },
      { slug: 'training', name: 'Training equipment', blurb: 'Pull buoys and drills.' },
      { slug: 'accessories', name: 'Accessories', blurb: 'Towels and kit bags.' },
    ],
  },
  {
    slug: 'running',
    name: 'Running',
    tier: 'minor',
    tagline: 'Every kilometre counts.',
    description: 'Road shoes and the essentials for every kilometre.',
    accent: '#F36A32',
    accentSoft: '#FCE6DC',
    subs: [
      { slug: 'shoes', name: 'Running shoes', blurb: 'Road and race shoes.' },
      { slug: 'accessories', name: 'Accessories', blurb: 'Hydration and carry.' },
    ],
  },
  {
    slug: 'fitness',
    name: 'Fitness',
    tier: 'minor',
    tagline: 'Strength, built daily.',
    description: 'Free weights and floor essentials for home and gym.',
    accent: '#8E9590',
    accentSoft: '#ECEDEA',
    subs: [
      { slug: 'weights', name: 'Weights', blurb: 'Dumbbells and kettlebells.' },
      { slug: 'mats', name: 'Mats', blurb: 'Training and yoga mats.' },
    ],
  },
  {
    slug: 'basketball',
    name: 'Basketball',
    tier: 'minor',
    tagline: 'Own the court.',
    description: 'Balls and shoes for indoor and outdoor courts.',
    accent: '#E07A2E',
    accentSoft: '#FBE9DA',
    subs: [
      { slug: 'balls', name: 'Basketballs', blurb: 'Indoor and outdoor balls.' },
      { slug: 'shoes', name: 'Basketball shoes', blurb: 'Court shoes.' },
    ],
  },
  {
    slug: 'outdoor',
    name: 'Outdoor',
    tier: 'minor',
    tagline: 'Further, higher, wilder.',
    description: 'Shells and footwear for trails and mountains.',
    accent: '#5E7D6A',
    accentSoft: '#E3EBE5',
    subs: [
      { slug: 'jackets', name: 'Jackets', blurb: 'Waterproof shells.' },
      { slug: 'footwear', name: 'Footwear', blurb: 'Hiking boots.' },
    ],
  },
];

export const sportMap: Record<SportSlug, Sport> = Object.fromEntries(sports.map((s) => [s.slug, s])) as Record<
  SportSlug,
  Sport
>;
