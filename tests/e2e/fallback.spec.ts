import { expect, test } from '@playwright/test';

// Runs with WebGL disabled: the store is built on real photos/video and must not depend on it.
test('with WebGL disabled the hero falls back and the store still works', async ({ page }) => {
  await page.goto('/');
  // the hero is films and stills — nothing in it needs WebGL
  await expect(page.locator('section[aria-roledescription="carousel"] canvas')).toHaveCount(0);
  await expect(page.getByTestId('hero-stage').locator('img').first()).toBeVisible();
  await page.getByRole('link', { name: /Explore football/i }).click();
  await expect(page).toHaveURL(/\/football$/);
  await page.goto('/football/boots');
  await expect(page.getByRole('region', { name: 'The boot wall' })).toBeVisible();
  await expect(page.locator('#listing article').first()).toBeVisible();
  await page.goto('/product/adidas-f50-hyperfast-elite-fg-soccer-cleats');
  await expect(page.getByRole('img', { name: /F50 Hyperfast Elite/ }).first()).toBeVisible();
});
