// Dev-only QA for the crystal hero: freezes the opening at given seconds (window.__crystalT)
// and captures every sport. node scripts/hero-frames.mjs --out=dir [--w=390 --h=844 --times=0.4,0.9,1.32,1.6,3]
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const out = arg('out', 'qa-hero');
const W = Number(arg('w', '390'));
const H = Number(arg('h', '844'));
const times = arg('times', '0.4,0.9,1.32,1.7,3').split(',').map(Number);
const sports = Number(arg('sports', '4'));
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 768 ? 2 : 1 })).newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(process.env.QA_BASE ?? 'http://localhost:3000/');
await p.getByRole('status', { name: 'Loading' }).waitFor({ state: 'detached', timeout: 60000 });
await p.mouse.move(W - 4, H * 0.45); // hovering the stage pauses the autoplay
await p.waitForTimeout(1500);
for (let s = 0; s < sports; s++) {
  if (s) {
    await p.getByRole('group', { name: 'Choose sport' }).getByRole('button').nth(s).click();
    await p.waitForTimeout(1500);
  }
  for (const t of times) {
    await p.evaluate((v) => (window.__crystalT = v), t);
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(out, `s${s}-${t.toFixed(2).padStart(5, '0')}.png`) });
  }
  await p.evaluate(() => (window.__crystalT = undefined));
}
const fps = await p.evaluate(
  () =>
    new Promise((r) => {
      let n = 0;
      const t0 = performance.now();
      const f = () => {
        n++;
        if (performance.now() - t0 < 2000) requestAnimationFrame(f);
        else r(n / 2);
      };
      requestAnimationFrame(f);
    }),
);
console.log('fps', fps);
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
await b.close();
