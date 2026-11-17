// Renders representative product images from the procedural models.
// Usage: start `npm run dev`, then `npm run renders` (optionally `-- --only=f50 --angles=hero --png --out=dir`).
// Uses the locally installed Microsoft Edge through Playwright (no browser download).
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const BASE = process.env.RENDER_BASE ?? 'http://localhost:3000';
const ONLY = arg('only', '');
const ANGLES = arg('angles', 'hero,side,top,detail').split(',');
const OUT = arg('out', 'public/renders');
const PNG = process.argv.includes('--png');
const SIZE = Number(arg('size', '1024'));

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.RENDER_CHANNEL ?? 'msedge',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=default'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`${BASE}/render`, { waitUntil: 'networkidle', timeout: 180_000 });
await page.waitForFunction(() => window.__renderReady === true, null, { timeout: 180_000 });
const jobs = await page.evaluate(() => window.__jobs);

let n = 0;
for (const job of jobs) {
  if (ONLY && !ONLY.split(',').some((o) => job.slug.includes(o))) continue;
  for (const [ci, colorId] of job.colors.entries()) {
    for (const angle of ANGLES) {
      if (ci > 0 && angle !== 'hero') continue; // extra angles only for the default colour
      const url = await page.evaluate(
        ([s, c, a, size, type]) => window.__render(s, c, a, size, type),
        [job.slug, colorId, angle, SIZE, PNG ? 'image/png' : 'image/webp'],
      );
      const file = path.join(OUT, `${job.slug}--${colorId}--${angle}.${PNG ? 'png' : 'webp'}`);
      await fs.writeFile(file, Buffer.from(url.split(',')[1], 'base64'));
      n++;
    }
  }
  process.stdout.write('.');
}
console.log(`\nrendered ${n} images → ${OUT}`);
await browser.close();
