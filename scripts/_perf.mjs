import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__hero, null, { timeout: 90000 });
await page.getByRole('button', { name: 'Skip intro' }).click().catch(() => {});
for (const i of [0, 1, 2]) {
  const r = await page.evaluate(async (i) => {
    const h = window.__hero; h.ensure(i); h.cutTo(i); h.scenes[i].skipIntro();
    await new Promise((r) => setTimeout(r, 800));
    const t0 = performance.now(); let n = 0;
    await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    return { scene: i, q: h.quality, fps: +(n / 2.5).toFixed(1) };
  }, i);
  console.log(r);
}
await browser.close();
