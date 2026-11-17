import { expect, test } from '@playwright/test';

// Runs with WebGL disabled: the store is built on real photos/video and must not depend on it.
test('with WebGL disabled the hero, showroom and product page still work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('canvas[data-engine], section[aria-roledescription="carousel"] canvas')).toHaveCount(0);
  await page.getByRole('link', { name: /Explore football/i }).click();
  await expect(page).toHaveURL(/\/football$/);
  await page.goto('/football/boots');
  await expect(page.getByRole('region', { name: 'The boot wall' })).toBeVisible();
  await expect(page.locator('#listing article').first()).toBeVisible();
  await page.goto('/product/adidas-f50-hyperfast-elite-fg-soccer-cleats');
  await expect(page.getByRole('img', { name: /F50 Hyperfast Elite/ }).first()).toBeVisible();
});
