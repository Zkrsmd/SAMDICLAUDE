// Dev-only QA: renders frozen frames of each hero film. node scripts/film-frames.mjs --out=dir [--w=390 --h=844]
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const out = arg('out', 'qa-film');
const W = Number(arg('w', '390'));
const H = Number(arg('h', '844'));
const times = arg('times', '0.3,0.55,0.75,1.1,1.6,3.4').split(',').map(Number);
await fs.mkdir(out, { recursive: true });
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 768 ? 2 : 1 })).newPage();
await p.goto(process.env.QA_BASE ?? 'http://localhost:3000/');
await p.getByRole('button', { name: 'Skip intro' }).click().catch(() => {});
await p.getByRole('status', { name: 'Loading' }).waitFor({ state: 'detached', timeout: 30000 });
await p.waitForTimeout(1800);
for (let s = 0; s < 4; s++) {
  if (s) {
    await p.getByRole('group', { name: 'Choose sport' }).getByRole('button').nth(s).click();
    await p.waitForTimeout(1200);
  }
  for (const t of times) {
    await p.evaluate((v) => (window.__heroT = v), t);
    await p.waitForTimeout(120);
    const f = path.join(out, `s${s}-${t.toFixed(2).padStart(5, '0')}.png`);
    await p.screenshot({ path: f });
  }
  await p.evaluate(() => (window.__heroT = undefined));
}
console.log('done');
await b.close();
