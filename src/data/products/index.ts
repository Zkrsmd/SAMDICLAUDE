import type { ModelKind, Product, SportSlug } from '@/types/catalog';
import generated from './generated.json';

/**
 * The shop's catalogue: the products registered in Odoo (scripts/import-odoo.mjs → names cleaned,
 * sorted into sports and categories, Odoo sales prices) plus the jersey collection, with photos
 * found by scripts/fetch-images.mjs. Everything starts as "Coming soon": the admin switches a
 * product on when it is ready to sell (stock, price, photo checked).
 */
interface Row {
  slug: string;
  name: string;
  brand: string;
  sport: SportSlug;
  sub: string;
  /** centimes of a dinar */
  price: number;
  sizes: string[];
  sku: string;
  /** Odoo quantity on hand (never below 0) */
  qty: number;
  /** units sold beyond the counted stock in Odoo — a popularity signal */
  sold: number;
  photo: boolean;
  jersey?: boolean;
  team?: string;
}

export const KIND: Record<string, ModelKind> = {
  boots: 'boot', shoes: 'boot', balls: 'ball', handballs: 'ball', gloves: 'glove', 'hand-wraps': 'handwrap', mouthguards: 'mouthguard',
  'head-protection': 'headgear', 'punching-bags': 'heavybag', goggles: 'goggles', caps: 'cap', swimwear: 'swimsuit', burkinis: 'swimsuit',
  'swim-shorts': 'shorts', fins: 'fins', apparel: 'shorts', weights: 'dumbbell', mats: 'mat', jerseys: 'jersey', socks: 'sock',
  'shin-guards': 'shinguard', shakers: 'bottle', bags: 'bag', tracksuits: 'jacket', kits: 'jersey', pads: 'mitt', goalkeeper: 'glove',
};

export const PAIRS: Record<string, string[]> = {
  'football/boots': ['football/socks', 'football/shin-guards', 'football/balls'],
  'football/jerseys': ['football/tracksuits', 'football/boots', 'fan/flags'],
  'football/balls': ['football/boots', 'football/accessories'],
  'football/tracksuits': ['football/jerseys', 'football/boots'],
  'football/goalkeeper': ['football/boots', 'football/balls'],
  'boxing/gloves': ['boxing/hand-wraps', 'boxing/mouthguards', 'boxing/head-protection'],
  'boxing/hand-wraps': ['boxing/gloves', 'boxing/mouthguards'],
  'boxing/punching-bags': ['boxing/gloves', 'boxing/hand-wraps'],
  'boxing/apparel': ['boxing/gloves', 'boxing/protection'],
  'martial-arts/suits': ['martial-arts/belts', 'martial-arts/gloves'],
  'swimming/goggles': ['swimming/caps', 'swimming/swim-shorts', 'swimming/training'],
  'swimming/caps': ['swimming/goggles', 'swimming/burkinis'],
  'swimming/burkinis': ['swimming/caps', 'swimming/goggles'],
  'swimming/kids': ['swimming/goggles', 'pool/inflatables'],
  'diving/masks': ['diving/fins', 'diving/snorkels'],
  'diving/fins': ['diving/masks', 'diving/snorkels'],
  'pool/inflatables': ['pool/pumps', 'swimming/kids'],
  'fishing/rods': ['fishing/reels', 'fishing/line', 'fishing/lures'],
  'fishing/reels': ['fishing/rods', 'fishing/line'],
  'fitness/weights': ['fitness/gloves-belts', 'fitness/mats', 'fitness/shakers'],
  'fitness/bands': ['fitness/mats', 'fitness/equipment'],
  'running/shoes': ['running/accessories', 'recovery/supports'],
  'basketball/balls': ['basketball/apparel', 'pool/pumps'],
  'volleyball/balls': ['volleyball/nets'],
};

/** One line under the name, per category. */
const SHORT: Record<string, string> = {
  'football/jerseys': 'The new kit, ready for match day.',
  'football/boots': 'Grip, touch and a locked-in fit.',
  'football/balls': 'True flight and a clean touch.',
  'football/tracksuits': 'Warm-up to the final whistle.',
  'football/kits': 'A full set for training and match day.',
  'football/goalkeeper': 'Grip and protection between the posts.',
  'football/shin-guards': 'Light protection that stays in place.',
  'football/socks': 'Comfort and grip through 90 minutes.',
  'football/referee': 'Run the game.',
  'football/trophies': 'For the winners.',
  'football/accessories': 'The details every team needs.',
  'boxing/gloves': 'Padded protection and a secure wrist.',
  'boxing/hand-wraps': 'The first layer under every glove.',
  'boxing/punching-bags': 'Built to take power work.',
  'boxing/pads': 'Sharpen speed, timing and combinations.',
  'boxing/head-protection': 'Sparring protection with a clear view.',
  'boxing/protection': 'Protection for every exchange.',
  'boxing/mouthguards': 'Protect your teeth and jaw.',
  'boxing/apparel': 'Free movement for every round.',
  'martial-arts/suits': 'Strong cotton for training and grading.',
  'martial-arts/belts': 'Every grade colour.',
  'swimming/goggles': 'A clear, sealed view lap after lap.',
  'swimming/caps': 'Keeps you streamlined.',
  'swimming/burkinis': 'Full coverage, quick-drying comfort.',
  'swimming/swimwear': 'Comfort in and out of the water.',
  'swimming/kids': 'Confidence in the water for little swimmers.',
  'diving/masks': 'A wide view under water.',
  'diving/fins': 'Power and glide in open water.',
  'pool/inflatables': 'Summer fun for the whole family.',
  'pool/pumps': 'Inflate in minutes.',
  'pool/pool-care': 'Keep the water clean and clear.',
  'fishing/rods': 'Cast further, feel every bite.',
  'fishing/reels': 'Smooth retrieve, strong drag.',
  'fishing/line': 'Strong, low-memory line.',
  'fishing/lures': 'Proven on the coast.',
  'fitness/weights': 'Strength training at home or in the gym.',
  'fitness/bands': 'Resistance you can take anywhere.',
  'fitness/equipment': 'Train strength, grip and core.',
  'fitness/apparel': 'Comfort and support for every session.',
  'fitness/slimming': 'Sweat more in every workout.',
  'recovery/supports': 'Support and stability where you need it.',
  'recovery/massage': 'Relieve tired muscles.',
  'running/shoes': 'Cushioned and fast for every run.',
  'basketball/balls': 'Grip and a true bounce on any court.',
  'fan/flags': 'Show your colours.',
};

export const STORE_BRANDS: Record<string, string> = {
  nike: 'Nike', adidas: 'adidas', puma: 'PUMA', venum: 'Venum', everlast: 'Everlast', wilson: 'Wilson', arena: 'arena', molten: 'Molten', mikasa: 'Mikasa',
  intex: 'Intex', bestway: 'Bestway', cressi: 'Cressi', beuchat: 'Beuchat', salvimar: 'Salvimar', shimano: 'Shimano', daiwa: 'Daiwa', decathlon: 'Decathlon',
  uhlsport: 'Uhlsport', kempa: 'Kempa', derbystar: 'Derbystar', select: 'Select', umbro: 'Umbro', lotto: 'Lotto', joma: 'Joma', hummel: 'hummel',
  'under-armour': 'Under Armour', asics: 'ASICS', hoka: 'HOKA', ufc: 'UFC', fairtex: 'Fairtex', buka: 'Buka', arawaza: 'Arawaza', matsuru: 'Matsuru',
  tokaido: 'Tokaido', fox40: 'Fox 40', conquest: 'Conquest', aquasub: 'Aqua Sub', aquaflow: 'Aquaflow', sibote: 'Sibote', herakles: 'Herakles',
  'the-north-face': 'The North Face', 'golds-gym': "Gold's Gym", other: 'Other brands',
};

/** Hero / flagship products. */
export const FEATURED = ['psg-2026-27-home-jersey', 'algeria-2026-world-cup-home-jersey', 'real-madrid-2026-27-home-jersey', 'fc-barcelona-2026-27-home-jersey'];

const rows = generated as Row[];
/** Best sellers: what sold beyond the counted stock in the shop, plus the flagship jerseys. */
const BEST = new Set([...FEATURED, ...rows.filter((r) => r.sold >= 3 && r.photo).map((r) => r.slug)]);

export const rawProducts: (Product & { images: string[] })[] = rows.map((r) => {
  const key = `${r.sport}/${r.sub}`;
  const short = SHORT[key] ?? 'Coming soon to REVO.';
  const brand = STORE_BRANDS[r.brand] ? r.brand : 'other';
  const brandLine = brand === 'other' ? '' : `${STORE_BRANDS[brand]}. `;
  return {
    id: r.slug,
    slug: r.slug,
    name: r.name,
    brand,
    sport: r.sport,
    sub: r.sub,
    price: r.price,
    comingSoon: true,
    // the website keeps its own stock: one-size products start from the shop's count, sized ones at 0 until the admin counts them
    stock: Object.fromEntries(r.sizes.map((s) => [s, r.sizes.length === 1 ? r.qty : 0])),
    short,
    description: `${brandLine}${r.name}. ${short} Cash on delivery anywhere in Algeria.`,
    features: [],
    specs: [{ label: 'Colour', value: 'As shown' }],
    sizes: r.sizes,
    colors: [{ id: 'standard', name: 'As shown', swatch: ['#8E99A8'], palette: { primary: '#8E99A8', secondary: '#8E99A8', accent: '#8E99A8' } }],
    model: { kind: KIND[r.sub] ?? 'bag' },
    tags: [r.sport, r.sub.replace(/-/g, ' '), ...(r.team ? [r.team.toLowerCase()] : []), ...(r.jersey ? ['jersey', 'maillot', 'kit'] : [])],
    featured: FEATURED.includes(r.slug),
    bestSeller: BEST.has(r.slug),
    isNew: !!r.jersey,
    verified: false,
    sourceNote: r.jersey ? 'Jersey collection (2026/27 club kits, World Cup 2026 teams).' : 'Imported from the shop’s Odoo catalogue.',
    pairsWith: PAIRS[key],
    images: [`/products/${r.slug}-1.webp`],
    photo: r.photo,
    sku: r.sku || undefined,
  };
});
