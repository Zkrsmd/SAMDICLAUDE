// Builds a self-contained snapshot of the homepage for the Claude artifact preview.
// Run after `SMADI_STATIC=1 npm run build` (plain images, no optimizer):  node scripts/snapshot.mjs
// Output: .snapshot/ with index.html (tiny launcher), home.html (the real prerendered page), next/static/** (Next's _next, renamed: artifact names may not start with _),
// and only the product / brand files the homepage uses. All paths are made relative so it runs from any URL.
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '.snapshot');
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

const rel = (s) =>
  s
    .replaceAll('"/_next/', '"next/')
    .replaceAll("'/_next/", "'next/")
    .replaceAll('\\"/_next/', '\\"next/')
    .replaceAll('"/products/', '"products/')
    .replaceAll('\\"/products/', '\\"products/')
    .replaceAll('`/products/', '`products/')
    .replaceAll('"/brands/', '"brands/')
    .replaceAll('\\"/brands/', '\\"brands/')
    .replaceAll('"/icon.svg', '"icon.svg')
    // the artifact host refuses a literal U+FFFD; inside JS strings the escape is identical
    .replaceAll(String.fromCharCode(0xfffd), '\\' + 'uFFFD');

// the page itself: tell Turbopack to load chunks relative to this document
let html = await fs.readFile(path.join(root, '.next/server/app/index.html'), 'utf8');
const used = new Set([...html.matchAll(/\/(products|brands)\/([\w.\-]+\.(?:webp|svg|png|jpg))/g)].map((m) => `${m[1]}/${m[2]}`));
const cfg = await fs.readFile(path.join(root, 'src/config/hero.ts'), 'utf8');
for (const m of cfg.matchAll(/'([a-z0-9][a-z0-9-]{8,})'/g)) used.add(`products/${m[1]}-1.webp`);
const worlds = await fs.readFile(path.join(root, 'src/components/hero/crystal/worlds.ts'), 'utf8');
for (const m of worlds.matchAll(/product: '([a-z0-9-]+)'/g)) used.add(`products/${m[1]}-1.webp`);
html = rel(html).replace('<head>', '<head><script>var TURBOPACK_CHUNK_BASE_PATH="next/";</script>');
await fs.writeFile(path.join(out, 'home.html'), html);

// all static chunks (the 3D engine is loaded on demand, so take every file)
async function copyDir(from, to, transform) {
  await fs.mkdir(to, { recursive: true });
  for (const e of await fs.readdir(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) await copyDir(a, b, transform);
    else if (transform && /\.(js|css)$/.test(e.name)) await fs.writeFile(b, transform(await fs.readFile(a, 'utf8')));
    else await fs.copyFile(a, b);
  }
}
await copyDir(path.join(root, '.next/static'), path.join(out, 'next/static'), rel);

let n = 0;
for (const f of used) {
  try {
    await fs.mkdir(path.dirname(path.join(out, f)), { recursive: true });
    const src = path.join(root, 'public', f);
    // the artifact host refuses XML with DTD declarations: drop the (unneeded) SVG doctype
    if (f.endsWith('.svg')) await fs.writeFile(path.join(out, f), (await fs.readFile(src, 'utf8')).replace(/<!DOCTYPE[^>]*>/i, ''));
    else await fs.copyFile(src, path.join(out, f));
    n++;
  } catch {
    /* not every guessed slug exists */
  }
}
await fs.copyFile(path.join(root, 'src/app/icon.svg'), path.join(out, 'icon.svg')).catch(() => {});

// launcher: the artifact page itself just opens the real page
await fs.writeFile(
  path.join(out, 'index.html'),
  `<title>SMADI Store</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>:root{--bg:#F3F4F6;--fg:#0F1216}body{background:var(--bg);color:var(--fg);font:15px system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}a{color:#2B59FF}</style>
<p>Opening SMADI… <a href="home.html">Tap here if it doesn't open</a></p>
<script>location.replace('home.html' + location.hash);</script>
`,
);
console.log(`snapshot: ${n} images, ${used.size} referenced`);
