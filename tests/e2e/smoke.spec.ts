import { expect, test } from '@playwright/test';
import { openHome } from './helpers';

const ROUTES = ['/', '/sportswear', '/combat-sports', '/competition', '/martial-arts/judo', '/boxing/kickboxing', '/football', '/football/jerseys', '/boxing/gloves', '/swimming/goggles', '/fishing', '/pool', '/product/psg-2026-27-home-jersey', '/product/fox-40-classic-whistle', '/search?q=intex', '/cart', '/wishlist', '/checkout'];

test('key routes render without page errors', async ({ page }) => {
  // 13 image-heavy pages in a row: don't wait for every product photo to finish loading
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const r of ROUTES) {
    const res = await page.goto(r, { waitUntil: 'domcontentloaded' });
    expect(res?.status(), r).toBeLessThan(400);
    await expect(page.locator('main')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('on a phone every page is exactly as wide as the screen (French and Arabic), so nothing opens zoomed out', async ({ page, context }, info) => {
  test.skip(!info.project.name.includes('mobile'), 'phone layout');
  test.setTimeout(180_000);
  // a full bag, so the order list under "Order now" is shown with long names
  await page.goto('/product/fox-40-classic-whistle', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() =>
    localStorage.setItem(
      'yb-cart-v1',
      JSON.stringify({
        state: {
          lines: [
            { productId: 'venum-boxing-gloves-black-gold', colorId: 'standard', size: '12 oz', qty: 3 },
            { productId: 'fox-40-classic-whistle', colorId: 'standard', size: 'One size', qty: 1 },
          ],
        },
        version: 1,
      }),
    ),
  );
  for (const lang of ['fr', 'ar']) {
    await context.addCookies([{ name: 'lang', value: lang, url: page.url() }]);
    for (const r of ['/', '/football/jerseys', '/search?q=maillot', '/product/fox-40-classic-whistle', '/cart', '/checkout']) {
      await page.goto(r, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const w = await page.evaluate(() => ({ inner: window.innerWidth, doc: document.documentElement.clientWidth }));
      expect(w.inner, `${lang} ${r}`).toBe(w.doc);
    }
  }
});

test('hero is usable and the store is reachable without swiping', async ({ page }) => {
  await openHome(page);
  // the banner: seven slides, films that loop, no pause button
  const index = page.getByRole('group', { name: 'Choose sport' });
  await expect(index.getByRole('button')).toHaveCount(7);
  for (const name of ['Football', 'Sportswear', 'Martial arts', 'Fitness', 'Swimming', 'Competition', 'Diving']) await expect(index.getByRole('button', { name })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pause the films/ })).toHaveCount(0);
  await index.getByRole('button', { name: 'Sportswear' }).click();
  await expect(page.getByRole('link', { name: /Explore sportswear/i })).toHaveAttribute('href', '/sportswear');
  await page.getByRole('group', { name: 'Choose sport' }).getByRole('button', { name: 'Swimming' }).click();
  await expect(page.getByRole('link', { name: /Explore swimming/i })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Home' }).first()).toBeAttached();
});

test('unknown routes return the 404 page', async ({ page }) => {
  const res = await page.goto('/not-a-sport');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Out of bounds' })).toBeVisible();
});

test('security headers are present', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
});

test('first visit asks for a language; French and Arabic switch the whole store', async ({ browser, baseURL }, info) => {
  test.skip(info.project.name !== 'desktop', 'once, on desktop');
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/');
  const gate = page.getByRole('dialog', { name: /Choose your language/ });
  await expect(gate).toBeVisible();
  await page.getByTestId('lang-fr').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(gate).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Choisissez votre/ })).toBeAttached();
  await page.goto('/football');
  await expect(page.getByRole('heading', { level: 1, name: 'Football' })).toBeVisible();
  await expect(page.locator('#listing').getByText(/\d+ résultats/)).toBeVisible();
  // the switcher: Arabic, right to left
  await page.locator('footer').getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'كرة القدم' })).toBeVisible();
  await context.close();
});

test('first visit: the intro plays once (flip-book, then the STRYKE card opens onto the page), never again that visit', async ({ page, context }, info) => {
  test.skip(info.project.name === 'reduced-motion', 'no intro with reduced motion');
  test.skip(info.project.name !== 'desktop' && !info.project.name.includes('mobile'), 'phone and desktop');
  await context.clearCookies({ name: 'stryke_intro' });
  await page.goto('/');
  const intro = page.locator('.intro');
  await expect(intro).toBeVisible();
  await expect(intro.locator('.intro-img[data-on]').first()).toBeAttached();
  // it opens onto the page and goes, and the visit remembers it
  await expect(intro).toHaveAttribute('data-state', 'done', { timeout: 12_000 });
  await expect(page.getByTestId('hero-stage')).toBeVisible();
  expect((await context.cookies()).some((c) => c.name === 'stryke_intro')).toBe(true);
  await page.goto('/football');
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('.intro')).toHaveCount(0);
});
