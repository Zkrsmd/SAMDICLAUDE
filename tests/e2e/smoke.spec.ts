import { expect, test } from '@playwright/test';
import { openHome } from './helpers';

const ROUTES = ['/', '/football', '/football/boots', '/boxing/gloves', '/swimming/goggles', '/running', '/product/speedo-fastskin-cap-pink', '/search?q=cap', '/cart', '/wishlist', '/checkout'];

test('key routes render without page errors', async ({ page }) => {
  // 11 image-heavy pages in a row: don't wait for every product photo to finish loading
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

test('hero is usable and the store is reachable without swiping', async ({ page }) => {
  await openHome(page);
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
