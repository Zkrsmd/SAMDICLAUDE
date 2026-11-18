import { expect, test } from '@playwright/test';

// Runs with WebGL disabled: the store is built on real photos/video and must not depend on it.
test('with WebGL disabled the hero, showroom and product page still work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0, { timeout: 30_000 });
  // the hero films are plain canvas 2D: they must still be playing with WebGL disabled
  await expect(page.locator('section[aria-roledescription="carousel"] canvas')).toHaveCount(1);
  await page.getByRole('link', { name: /Explore football/i }).click();
  await expect(page).toHaveURL(/\/football$/);
  await page.goto('/football/boots');
  await expect(page.getByRole('region', { name: 'The boot wall' })).toBeVisible();
  await expect(page.locator('#listing article').first()).toBeVisible();
  await page.goto('/product/adidas-f50-hyperfast-elite-fg-soccer-cleats');
  await expect(page.getByRole('img', { name: /F50 Hyperfast Elite/ }).first()).toBeVisible();
});
