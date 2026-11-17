// Visual QA helper: captures timed screenshots of a page in headless Edge.
// node scripts/qa-shots.mjs --url=/ --w=390 --h=844 --times=1,3,5 --out=dir [--actions=next@6,next@12] [--scroll=0.5@8]
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const arg = (n, f) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? f;
const BASE = process.env.QA_BASE ?? 'http://localhost:3000';
const url = BASE + arg('url', '/');
const W = Number(arg('w', '390'));
const H = Number(arg('h', '844'));
const times = arg('times', '2,4,6').split(',').map(Number);
const out = arg('out', 'qa');
const prefix = arg('prefix', 'shot');
const actions = arg('actions', '')
  .split(',')
  .filter(Boolean)
  .map((a) => {
    const [what, at] = a.split('@');
    return { what, at: Number(at) };
  });
const mobile = W < 768;

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: process.argv.includes('--reduced') ? 'reduce' : 'no-preference',
});
if (process.argv.includes('--fresh')) await ctx.clearCookies();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
const events = [...times.map((t) => ({ type: 'shot', at: t })), ...actions.map((a) => ({ type: 'act', ...a }))].sort((a, b) => a.at - b.at);
for (const ev of events) {
  const wait = ev.at * 1000 - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  if (ev.type === 'shot') {
    const info = await page.evaluate(() => {
      const h = window.__hero;
      if (!h) return null;
      const s = h.scenes[h.active];
      return { active: h.active, intro: h.introPhase, done: s?.introDone };
    });
    const file = path.join(out, `${prefix}-${String(ev.at).padStart(4, '0')}.png`);
    await page.screenshot({ path: file });
    console.log(file, JSON.stringify(info));
  } else if (ev.what === 'next') {
    await page.getByRole('button', { name: 'Next sport' }).click();
  } else if (ev.what === 'skip') {
    await page.getByRole('button', { name: 'Skip intro' }).click().catch(() => {});
  } else if (/^go\d$/.test(ev.what)) {
    await page.evaluate((n) => window.__hero?.goTo(n), Number(ev.what.slice(2)));
  } else if (ev.what.startsWith('scroll')) {
    const frac = Number(ev.what.slice(6) || '0.5');
    await page.evaluate((f) => window.scrollTo(0, window.innerHeight * f), frac);
  } else if (ev.what.startsWith('goto')) {
    await page.goto(BASE + ev.what.slice(4), { waitUntil: 'domcontentloaded' });
  }
}
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 15).join('\n'));
await browser.close();
