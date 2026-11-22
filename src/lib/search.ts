/**
 * Product search, shared by the search page (server, via src/lib/catalog.ts) and the instant search
 * overlay (browser, src/components/search/SearchOverlay.tsx).
 *
 * People type the way they talk: "gloves", "gants", "قفازات", "glove", "boxe", "maillot algerie",
 * "venum", "gant boxe enfant", with typos. So the search:
 * - normalises text (case, French accents, Arabic letter forms and vowel marks, punctuation);
 * - folds plurals and common forms ("gloves" → "glove", "gants" → "gant", "القفازات" → "قفاز");
 * - understands the same thing said in English, French, Arabic and Darija (a synonym table);
 * - matches the start of words while typing ("glo" → gloves) and forgives small typos ("glvoes");
 * - ranks: the product name counts most, then its category, brand and sport; products on sale
 *   and best sellers come first among equals;
 * - when nothing matches every word, still shows the closest products (most words matched).
 */

export interface SearchDoc {
  slug: string;
  /** the product name */
  name: string;
  brand: string;
  /** the category, in English, French and Arabic */
  sub: string;
  /** the sport, in English, French and Arabic */
  sport: string;
  /** tags and colours */
  extra: string;
  /** on sale (not coming soon / sold out) */
  live: boolean;
  best: boolean;
}

/** Same meaning, different words (English · French · Arabic · Darija). The first word is the group's key. */
const GROUPS: string[][] = [
  ['glove', 'gant', 'gants', 'gloves', 'قفاز', 'قفازات', 'ليڨون', 'mitt', 'mitts', 'mitaine'],
  ['jersey', 'maillot', 'shirt', 'tshirt', 'tenue', 'قميص', 'قمصان', 'مايو', 'تريكو', 'kit'],
  ['boot', 'crampon', 'crampons', 'chaussure', 'chaussures', 'shoe', 'shoes', 'sneaker', 'basket', 'baskets', 'حذاء', 'احذيه', 'سباط', 'صباط', 'سبادري'],
  ['ball', 'ballon', 'balle', 'كره', 'بالون'],
  ['goggle', 'lunette', 'lunettes', 'نظاره', 'نظارات'],
  ['swimsuit', 'swimwear', 'مايوه'],
  ['burkini', 'بوركيني'],
  ['cap', 'bonnet', 'casquette', 'hat', 'chapeau', 'قبعه', 'كاسكيط'],
  ['tracksuit', 'survetement', 'jogging', 'سورفاتمو'],
  ['short', 'shorts', 'شورت'],
  ['sock', 'chaussette', 'chaussettes', 'جوارب', 'تقاشر'],
  ['bag', 'sac', 'حقيبه', 'ساك'],
  ['racket', 'raquette', 'مضرب'],
  ['net', 'filet', 'شبكه'],
  ['rope', 'corde', 'حبل'],
  ['dumbbell', 'haltere', 'halteres', 'weight', 'weights', 'poids', 'دمبل', 'اثقال', 'حديد'],
  ['mat', 'tapis', 'سجاده', 'زربيه'],
  ['band', 'elastique', 'elastic', 'resistance', 'مطاط'],
  ['bottle', 'gourde', 'bouteille', 'shaker', 'قاروره'],
  ['whistle', 'sifflet', 'صفاره'],
  ['helmet', 'casque', 'headgear', 'خوذه'],
  ['mouthguard', 'protege-dents', 'protege dent', 'واقي'],
  ['shin', 'tibia', 'protege-tibias'],
  ['wrap', 'bande', 'bandage', 'باندا'],
  ['fin', 'palme', 'palmes', 'زعانف'],
  ['mask', 'masque', 'قناع'],
  ['snorkel', 'tuba'],
  ['pool', 'piscine', 'مسبح', 'بيسين'],
  ['rod', 'canne', 'صناره', 'قصبه'],
  ['reel', 'moulinet', 'بكره'],
  ['hook', 'hamecon', 'صنانير', 'خطاف'],
  ['lure', 'leurre', 'طعم'],
  ['kimono', 'judogi', 'karategi', 'كيمونو'],
  ['belt', 'ceinture', 'حزام'],
  ['kid', 'kids', 'enfant', 'enfants', 'junior', 'child', 'اطفال', 'طفل', 'صغار'],
  ['women', 'woman', 'femme', 'femmes', 'ladies', 'نساء', 'نسائي'],
  ['men', 'homme', 'hommes', 'رجال', 'رجالي'],
  ['football', 'foot', 'soccer', 'فوت', 'كوره'],
  ['boxing', 'boxe', 'ملاكمه', 'بوكس'],
  ['swimming', 'natation', 'nage', 'swim', 'سباحه'],
  ['fitness', 'musculation', 'gym', 'جيم'],
  ['running', 'course', 'جري'],
  ['fishing', 'peche', 'صيد'],
  ['diving', 'plongee', 'غوص'],
  ['basketball', 'basket'],
  ['volleyball', 'volley'],
  ['handball'],
  ['tennis', 'تنس'],
  ['algeria', 'algerie', 'dz', 'الجزائر', 'جزائر', 'دزاير', 'الخضرا'],
  ['goalkeeper', 'gardien', 'goal', 'حارس'],
];

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** lowercase, no accents, one form of each Arabic letter, letters/digits and spaces only */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ڨ/g, 'ق')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** fold plurals and the Arabic article so "gloves"/"glove", "gants"/"gant", "القفازات"/"قفاز" meet */
export function stem(w: string): string {
  if (/^[a-z]/.test(w)) {
    if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
    if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /[^s]s$/.test(w)) return w.slice(0, -1);
    if (w.length > 4 && w.endsWith('aux')) return `${w.slice(0, -3)}al`;
    if (w.length > 4 && w.endsWith('x')) return w.slice(0, -1);
    return w;
  }
  let a = w;
  if (a.length > 4 && a.startsWith('ال')) a = a.slice(2);
  if (a.length > 4 && (a.endsWith('ات') || a.endsWith('ين') || a.endsWith('ون'))) a = a.slice(0, -2);
  return a;
}

const words = (s: string) => normalize(s).split(' ').filter(Boolean).map(stem);

/** each word → the keys of the synonym groups it belongs to */
const SYN = new Map<string, Set<string>>();
for (const g of GROUPS) {
  const key = stem(normalize(g[0]!));
  for (const term of g)
    for (const w of words(term)) {
      if (!SYN.has(w)) SYN.set(w, new Set());
      SYN.get(w)!.add(key);
    }
}

/** a word and every word that means the same (the group keys) */
function expand(w: string): string[] {
  const out = new Set([w]);
  for (const key of SYN.get(w) ?? []) out.add(key);
  return [...out];
}

/** edits needed to turn a into b — a swapped pair of letters counts as one (stops early past `max`) */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length]!;
}

/** how well one typed word matches one word of the product (0 = not at all) */
function wordMatch(q: string, d: string): number {
  if (q === d) return 1;
  if (q.length >= 2 && d.startsWith(q)) return 0.85; // still typing
  if (q.length >= 4 && d.length >= 4) {
    const max = q.length >= 7 ? 2 : 1;
    if (distance(q, d, max) <= max) return 0.55; // a typo
  }
  return 0;
}

interface Prepared {
  fields: { words: string[]; weight: number }[];
}
const WEIGHTS: [keyof SearchDoc, number][] = [
  ['name', 3],
  ['sub', 2.4],
  ['brand', 2],
  ['sport', 1.4],
  ['extra', 1],
];

const prepared = new WeakMap<SearchDoc, Prepared>();
function prepare(doc: SearchDoc): Prepared {
  let p = prepared.get(doc);
  if (!p) {
    p = {
      fields: WEIGHTS.map(([k, weight]) => ({
        // every word plus the synonym-group keys it belongs to, so "gants" finds "gloves"
        words: [...new Set(words(String(doc[k])).flatMap(expand))],
        weight,
      })),
    };
    prepared.set(doc, p);
  }
  return p;
}

/** one typed word's best match anywhere in the product */
function termScore(p: Prepared, variants: string[]): number {
  let best = 0;
  for (const f of p.fields)
    for (const d of f.words)
      for (let i = 0; i < variants.length; i++) {
        const m = wordMatch(variants[i]!, d);
        if (m) best = Math.max(best, m * f.weight * (i === 0 ? 1 : 0.95));
      }
  return best;
}

/**
 * The products matching `query`, best first. Every typed word must match; if no product matches
 * them all, the closest ones (at least half the words matched) are returned instead.
 */
export function rankSearch<T extends SearchDoc>(docs: T[], query: string, limit = Infinity): T[] {
  const terms = [...new Set(words(query))];
  if (!terms.length) return [];
  const variants = terms.map(expand);
  const full: { doc: T; score: number }[] = [];
  const partial: { doc: T; score: number; hits: number }[] = [];
  for (const doc of docs) {
    const p = prepare(doc);
    let score = 0;
    let hits = 0;
    for (const v of variants) {
      const s = termScore(p, v);
      if (s > 0) hits++;
      score += s;
    }
    if (!hits) continue;
    score += (doc.live ? 0.6 : 0) + (doc.best ? 0.3 : 0);
    if (hits === terms.length) full.push({ doc, score });
    else partial.push({ doc, score, hits });
  }
  if (full.length) return full.sort((a, b) => b.score - a.score).slice(0, limit).map((r) => r.doc);
  const need = Math.max(1, Math.ceil(terms.length / 2));
  return partial
    .filter((r) => r.hits >= need)
    .sort((a, b) => b.hits - a.hits || b.score - a.score)
    .slice(0, limit)
    .map((r) => r.doc);
}
