// Lists every English text the store translates (t('…') calls + catalogue/category texts) and
// reports which are missing from src/i18n/fr.ts and ar.ts:  node scripts/i18n-keys.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';

const keys = new Set();
const SQ = /\bt\(\s*'((?:[^'\\]|\\.)+)'/g;
const DQ = /\bt\(\s*"((?:[^"\\]|\\.)+)"/g;
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) {
      if (!/admin|i18n/.test(f.name)) walk(p);
    } else if (/\.tsx?$/.test(f.name)) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(SQ)) keys.add(m[1].replace(/\\'/g, "'"));
      for (const m of s.matchAll(DQ)) keys.add(m[1]);
    }
  }
};
walk('src');
// data rendered through t(variable)
const cat = fs.readFileSync('src/data/categories.ts', 'utf8');
for (const m of cat.matchAll(/(?:name|tagline|description|blurb): '((?:[^'\\]|\\.)+)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
const prod = fs.readFileSync('src/data/products/index.ts', 'utf8');
const a = prod.indexOf('const SHORT');
for (const m of prod.slice(a, prod.indexOf('};', a)).matchAll(/: '((?:[^'\\]|\\.)+)'/g)) keys.add(m[1]);
for (const k of [
  'Coming soon to STRYKE.', 'Cash on delivery anywhere in Algeria.', 'Colour', 'As shown', 'within about an hour', 'Featured',
  'Price: low to high', 'Price: high to low', 'Name A–Z', 'The boot wall', 'The glove room', 'The lens bar', 'Built in', 'Made to',
  'Finished with', 'Detail', 'Enter your first name', 'Enter your last name',
])
  keys.add(k);
const hero = fs.readFileSync('src/config/hero.ts', 'utf8');
for (const m of hero.matchAll(/(?:word|cta): '([^']+)'/g)) keys.add(m[1]);
const brand = fs.readFileSync('src/config/brand.ts', 'utf8');
for (const m of brand.matchAll(/(?:tagline|description):\s*'([^']+)'/g)) keys.add(m[1]);
// messages that reach the shopper from validation, the APIs and the receipt
for (const f of ['src/lib/validation/order.ts', 'src/app/api/cart/quote/route.ts', 'src/app/(store)/order/[token]/page.tsx', 'src/app/api/orders/route.ts'])
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?:message: |, |\(|: |reason: |error: )'([A-Z][^'{}$`]{3,})'/g)) keys.add(m[1]);

const list = [...keys].sort();
const has = (file) => {
  if (!fs.existsSync(file)) return new Set();
  const s = fs.readFileSync(file, 'utf8');
  return new Set([...s.matchAll(/^\s*("(?:[^"\\]|\\.)*")\s*:/gm)].map((m) => JSON.parse(m[1])));
};
if (process.argv.includes('--json')) console.log(JSON.stringify(list, null, 1));
else
  for (const l of ['fr', 'ar']) {
    const h = has(`src/i18n/${l}.ts`);
    const miss = list.filter((k) => !h.has(k));
    console.log(`${l}: ${list.length - miss.length}/${list.length}${miss.length ? ' — missing: ' + miss.map((k) => JSON.stringify(k)).join(', ') : ''}`);
  }
