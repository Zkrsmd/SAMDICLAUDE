// Builds the demo catalogue from official brand listings collected in media-src/raw/*.json.
// Downloads each product image, cuts out light studio backgrounds (edge flood-fill key),
// writes public/products/<slug>-<n>.webp and src/data/products/generated.json.
// Images are the brands' copyright — demo use only; replace before going public (see ASSET_MANIFEST.md).
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const RAW = 'media-src/raw';
const CACHE = 'media-src/img';
const OUT = 'public/products';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const BRAND = { venum: 'venum', everlast: 'everlast', wilson: 'wilson', speedo: 'speedo', 'nike-boots': 'nike', 'nike-more': 'nike', adidas: 'adidas', puma: 'puma', arena: 'arena' };
const SOURCE = {
  venum: 'venum.com', everlast: 'everlast.com', wilson: 'wilson.com', speedo: 'speedo.com',
  'nike-boots': 'nike.com', 'nike-more': 'nike.com', adidas: 'adidas.com', puma: 'us.puma.com', arena: 'arenasport.com',
};
const SPORT_OF_VENUM = 'boxing';

const expand = (u) => {
  if (!u) return null;
  if (u.startsWith('S:')) return 'https://cdn.shopify.com/s/files/' + u.slice(2) + '?width=1400';
  if (u.startsWith('N:')) return 'https://static.nike.com/a/images/' + u.slice(2);
  if (u.startsWith('A:')) return 'https://assets.adidas.com/images/w_1400,f_auto,q_auto/' + u.slice(2);
  if (u.startsWith('P:')) return 'https://images.puma.com/image/upload/f_png,q_auto,w_1400/global/' + u.slice(2);
  if (u.startsWith('R:')) return 'https://www.arenasport.com/media/catalog/product/' + u.slice(2);
  return u;
};
const slugify = (s) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Removes a light, uniform background by flood-filling from the image border. */
async function cutout(buf) {
  const img = sharp(buf).ensureAlpha().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // already transparent? keep
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 20) transparent++;
  if (transparent > (data.length / (4 * 97)) * 0.08) return { data, info, keyed: false };
  // sample the background from the corners
  const px = (x, y) => (y * w + x) * 4;
  const corners = [px(2, 2), px(w - 3, 2), px(2, h - 3), px(w - 3, h - 3)].map((i) => [data[i], data[i + 1], data[i + 2]]);
  const bg = corners.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4, a[2] + c[2] / 4], [0, 0, 0]);
  const lum = (bg[0] + bg[1] + bg[2]) / 3;
  if (lum < 200) return { data, info, keyed: false }; // not a studio background (lifestyle shot) — leave it
  const dist = (i) => Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
  const HARD = 14;
  const SOFT = 34;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const d = dist(i);
    if (d > SOFT) continue;
    data[i + 3] = d <= HARD ? 0 : Math.round(((d - HARD) / (SOFT - HARD)) * 255);
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  return { data, info, keyed: true };
}

async function fetchImage(url, file) {
  try {
    return await fs.readFile(file);
  } catch {
    /* not cached */
  }
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/png,image/*,*/*' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(file, buf);
  return buf;
}

async function dominant(data, _info) {
  // average of opaque, non-near-white pixels → swatch colour
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4 * 31) {
    if (data[i + 3] < 200) continue;
    const l = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (l > 235) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  if (!n) return '#D9D6CB';
  const hx = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase();
}

const DEFAULT_SIZES = {
  boots: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  shoes: ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12'],
  apparel: ['S', 'M', 'L', 'XL'],
};

await fs.mkdir(CACHE, { recursive: true });
await fs.mkdir(OUT, { recursive: true });
const files = (await fs.readdir(RAW)).filter((f) => f.endsWith('.json'));
const products = [];
const used = new Set();
let n = 0;
for (const f of files) {
  const key = f.replace('.json', '');
  const brand = BRAND[key];
  const rows = JSON.parse(await fs.readFile(path.join(RAW, f), 'utf8'));
  for (const r of rows) {
    // venum rows: [title, price, img1, img2, sub, handle, sizes]; others: [title, price, img1, img2, "sport/sub", sizes]
    const [title, price, img1, img2] = r;
    const where = key === 'venum' ? `${SPORT_OF_VENUM}/${r[4]}` : r[4];
    const sizesRaw = key === 'venum' ? r[6] : r[5];
    const [sport, sub] = where.split('/');
    let slug = slugify(`${title.toLowerCase().startsWith(brand) ? '' : brand + ' '}${title}`);
    while (used.has(slug)) slug += '-2';
    used.add(slug);
    const images = [];
    let swatch = '#D9D6CB';
    for (const [k, u] of [img1, img2].entries()) {
      if (!u) continue;
      const url = expand(u);
      const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp)$/i)?.[1] ?? 'img').toLowerCase();
      try {
        const buf = await fetchImage(url, path.join(CACHE, `${slug}-${k + 1}.${ext}`));
        const { data, info, keyed } = await cutout(buf);
        await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
          .trim({ threshold: 1 })
          .webp({ quality: 86, alphaQuality: 90 })
          .toFile(path.join(OUT, `${slug}-${k + 1}.webp`));
        images.push({ src: `/products/${slug}-${k + 1}.webp`, cutout: keyed || info.channels === 4 });
        if (k === 0) swatch = await dominant(data, info);
      } catch (e) {
        console.warn('  ! image failed', slug, e.message);
      }
    }
    if (!images.length) continue;
    const colorName = title.includes(' - ') ? title.split(' - ').pop().trim() : 'Standard';
    const sizes = (sizesRaw?.length ? sizesRaw : DEFAULT_SIZES[sub] ?? ['One size']).map(String);
    products.push({
      slug,
      name: title.replace(/^(Venum|Everlast|Wilson|Speedo)\s+/i, ''),
      brand,
      sport,
      sub,
      price: Math.round(Number(price) * 100),
      images: images.map((i) => i.src),
      sizes,
      colorName,
      swatch,
      source: SOURCE[key],
    });
    n++;
    process.stdout.write('.');
  }
}
await fs.writeFile('src/data/products/generated.json', JSON.stringify(products, null, 1));
console.log(`\n${n} products → src/data/products/generated.json`);
