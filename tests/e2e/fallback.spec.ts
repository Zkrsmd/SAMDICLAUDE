import { expect, test } from '@playwright/test';

test('without WebGL the hero shows the poster and the store still works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status', { name: /Loading/ })).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('section[aria-roledescription="carousel"] canvas')).toHaveCount(0);
  await expect(page.getByRole('img', { name: /F50 Elite/ }).first()).toBeAttached();
  await page.getByRole('link', { name: /Explore football/i }).click();
  await expect(page).toHaveURL(/\/football$/);
  await page.goto('/football/boots');
  await expect(page.locator('section[aria-label="3D showroom"]')).toHaveCount(0);
  await expect(page.locator('#listing article').first()).toBeVisible();
  await page.goto('/product/adidas-f50-elite-fg-coral-blaze');
  await expect(page.getByRole('button', { name: '3D' })).toBeDisabled();
});
