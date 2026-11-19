import { expect, type Page } from '@playwright/test';

/** Opens the homepage (the film hero shows at once — there is no intro). */
export async function openHome(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('hero-stage')).toBeVisible({ timeout: 60_000 });
  // hovering the stage pauses the hero autoplay, so a slide can't change under the next click
  await page.getByTestId('hero-stage').hover({ position: { x: 8, y: 320 } }).catch(() => {});
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1200) < 1024;

export async function cartCount(page: Page) {
  const label = await page.locator('#cart-button').getAttribute('aria-label');
  return Number(label?.match(/(\d+) items/)?.[1] ?? 0);
}
