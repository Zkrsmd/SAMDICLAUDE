// Writes the store catalogue (src/data/products/generated.json) from media-src/odoo/catalog.json
// (scripts/import-odoo.mjs) and the photos found by scripts/fetch-images.mjs. Run after either.
import fs from 'node:fs';

const list = JSON.parse(fs.readFileSync('media-src/odoo/catalog.json', 'utf8'));
const out = list.map((p) => ({
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  sport: p.sport,
  sub: p.sub,
  price: p.price,
  sizes: p.sizes,
  sku: p.sku ?? '',
  qty: p.qty ?? 0,
  sold: p.sold ?? 0,
  photo: fs.existsSync(`public/products/${p.slug}-1.webp`),
  ...(p.jersey ? { jersey: true, team: p.team } : {}),
}));
const missing = out.filter((p) => !p.photo);
fs.writeFileSync('src/data/products/generated.json', JSON.stringify(out, null, 1) + '\n');
console.log(`${out.length} products, ${missing.length} without a photo${missing.length ? ': ' + missing.map((p) => p.slug).join(', ') : ''}`);
