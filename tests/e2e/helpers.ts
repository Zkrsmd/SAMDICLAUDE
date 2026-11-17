import { expect, type Page } from '@playwright/test';

/** Opens the homepage and skips the intro loader. */
export async function openHome(page: Page) {
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Skip intro' });
  await skip.click({ timeout: 20_000 }).catch(() => {});
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0, { timeout: 30_000 });
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1200) < 1024;

export async function cartCount(page: Page) {
  const label = await page.locator('#cart-button').getAttribute('aria-label');
  return Number(label?.match(/(\d+) items/)?.[1] ?? 0);
}
