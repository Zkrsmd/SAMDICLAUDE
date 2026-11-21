// Finds a product photo for every catalogue entry (media-src/odoo/catalog.json) with an image search,
// keys out a light studio background and writes public/products/<slug>-1.webp.
//   node scripts/fetch-images.mjs            → every product that has no photo yet
//   node scripts/fetch-images.mjs <slug> <n> → re-pick: use the n-th search result for that product
//   node scripts/fetch-images.mjs <slug> <url> → use this exact image
// The choice per product is kept in media-src/odoo/images.json (search query, candidate URLs, pick),
// so a wrong photo can be swapped by hand. Photos belong to their makers/retailers.
import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const CATALOG = 'media-src/odoo/catalog.json';
const LOG = 'media-src/odoo/images.json';
const OUT = 'public/products';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MAX_BYTES = 8 * 1024 * 1024;

const list = JSON.parse(readFileSync(CATALOG, 'utf8'));
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : {};
const save = () => writeFileSync(LOG, JSON.stringify(log, null, 1));

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"');

async function search(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1&qft=+filterui:imagesize-large`;
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const html = await res.text();
  const out = [];
  for (const m of html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)) {
    const u = decode(m[1]);
    if (/^https:\/\//.test(u) && !out.includes(u)) out.push(u);
    if (out.length >= 12) break;
  }
  return out;
}

async function download(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) throw new Error('too big');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('too big');
  const meta = await sharp(buf, { limitInputPixels: 60_000_000 }).metadata();
  if (!meta.width || !meta.height) throw new Error('not an image');
  if (Math.min(meta.width, meta.height) < 300) throw new Error('too small');
  const ratio = meta.width / meta.height;
  if (ratio > 2.2 || ratio < 0.45) throw new Error('odd shape');
  return buf;
}

/** how studio-like the photo is: corners near white (or already transparent) */
async function studioScore(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().resize(64, 64, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  let good = 0;
  let n = 0;
  for (const [x0, y0] of [[0, 0], [w - 6, 0], [0, w - 6], [w - 6, w - 6]])
    for (let y = y0; y < y0 + 6; y++)
      for (let x = x0; x < x0 + 6; x++) {
        const i = (y * w + x) * 4;
        n++;
        if (data[i + 3] < 30 || (data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232)) good++;
      }
  return good / n;
}

/** Removes a light, uniform background by flood-filling from the image border (same key as build-catalog). */
async function cutout(buf) {
  const img = sharp(buf).ensureAlpha().resize(1000, 1000, { fit: 'inside', withoutEnlargement: true });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4 * 97) if (data[i] < 20) transparent++;
  if (transparent > (data.length / (4 * 97)) * 0.08) return { data, info };
  const px = (x, y) => (y * w + x) * 4;
  const corners = [px(2, 2), px(w - 3, 2), px(2, h - 3), px(w - 3, h - 3)].map((i) => [data[i], data[i + 1], data[i + 2]]);
  const bg = corners.reduce((a, c) => [a[0] + c[0] / 4, a[1] + c[1] / 4, a[2] + c[2] / 4], [0, 0, 0]);
  if ((bg[0] + bg[1] + bg[2]) / 3 < 200) return { data, info };
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
  return { data, info };
}

async function write(slug, buf) {
  const { data, info } = await cutout(buf);
  const keyed = sharp(data, { raw: info });
  const trimmed = await keyed.png().toBuffer();
  let out = sharp(trimmed);
  try {
    out = sharp(await sharp(trimmed).trim({ threshold: 1 }).toBuffer());
  } catch {
    /* nothing to trim */
  }
  await out
    .resize(900, 900, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 80, alphaQuality: 90, effort: 5 })
    .toFile(`${OUT}/${slug}-1.webp`);
}

async function pick(p, forced) {
  const entry = (log[p.slug] ??= { query: p.query });
  if (!entry.candidates || entry.query !== p.query) {
    entry.query = p.query;
    entry.candidates = await search(p.query);
  }
  const tries = typeof forced === 'string' ? [forced] : typeof forced === 'number' ? [entry.candidates[forced]] : entry.candidates.slice(0, 8);
  let best = null;
  for (const url of tries) {
    if (!url) continue;
    try {
      const buf = await download(url);
      const score = await studioScore(buf);
      if (!best || score > best.score + 0.15) best = { url, buf, score };
      if (score > 0.9 || forced !== undefined) break; // a clean studio shot: take it
    } catch {
      /* next candidate */
    }
  }
  if (!best) {
    entry.pick = null;
    return false;
  }
  await write(p.slug, best.buf);
  entry.pick = best.url;
  entry.studio = Math.round(best.score * 100) / 100;
  return true;
}

const [slugArg, which] = process.argv.slice(2);
if (slugArg) {
  const p = list.find((x) => x.slug === slugArg);
  if (!p) throw new Error(`no product ${slugArg}`);
  const forced = which === undefined ? undefined : /^\d+$/.test(which) ? Number(which) : which;
  console.log(p.slug, (await pick(p, forced)) ? log[p.slug].pick : 'no image');
  save();
} else {
  const todo = list.filter((p) => !existsSync(`${OUT}/${p.slug}-1.webp`) && log[p.slug]?.pick !== null);
  console.log(`${todo.length} to fetch`);
  let done = 0;
  let failed = 0;
  const worker = async () => {
    while (todo.length) {
      const p = todo.shift();
      try {
        if (!(await pick(p))) failed++;
      } catch (e) {
        failed++;
        (log[p.slug] ??= {}).error = String(e.message ?? e);
      }
      if (++done % 25 === 0) {
        save();
        console.log(`${done} done, ${failed} without a photo`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  save();
  console.log(`finished: ${done} tried, ${failed} without a photo`);
}
await fs.mkdir(OUT, { recursive: true });
