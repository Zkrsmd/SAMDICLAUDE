import { expect, test } from '@playwright/test';
import { cartCount, isMobile, openHome } from './helpers';

test.describe('core shopping journeys', () => {
  test('1–5: homepage, skip loader, switch sports, scroll down', async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole('heading', { level: 1, name: /SMADI/ })).toBeAttached();
    const current = page.getByRole('group', { name: 'Choose sport' }).locator('[aria-current="true"]');
    await expect(current).toHaveAttribute('aria-label', 'Football');
    await page.getByRole('button', { name: 'Next sport' }).click();
    await expect(current).toHaveAttribute('aria-label', 'Boxing');
    await expect(page.getByRole('link', { name: /Explore boxing/i })).toBeVisible();
    await page.getByRole('button', { name: 'Next sport' }).click();
    await expect(current).toHaveAttribute('aria-label', 'Swimming');
    await expect(page.getByRole('link', { name: /Explore swimming/i })).toBeVisible();
    // native vertical scroll must pass straight through the hero (no scroll trap)
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.95));
    await expect(page.getByRole('heading', { name: /brands behind the performance/i })).toBeInViewport({ timeout: 15_000 });
  });

  test('6–9: football category → boot wall → product detail', async ({ page }) => {
    await openHome(page);
    await page.getByRole('link', { name: /Explore football/i }).click();
    await expect(page).toHaveURL(/\/football$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Football' })).toBeVisible();
    await page.getByRole('link', { name: /Football boots/ }).first().click();
    await expect(page).toHaveURL(/\/football\/boots/);
    await expect(page.getByRole('region', { name: 'The boot wall' })).toBeVisible();
    await page.locator('#listing').getByRole('link', { name: /F50 Hyperfast Elite/ }).first().click();
    await expect(page).toHaveURL(/\/product\/adidas-f50-hyperfast-elite-fg-soccer-cleats/);
    await expect(page.getByRole('heading', { level: 1, name: /F50 Hyperfast Elite/ })).toBeVisible();
  });

  test('10–14: zoom, size, add to bag, update quantity, remove', async ({ page }) => {
    await page.goto('/product/venum-giant-20-mike-tyson-pro-boxing-gloves-blackgold');
    // zoom into the product photo and close it again
    await page.getByRole('button', { name: 'Zoom into the product photo' }).click();
    const zoom = page.getByRole('dialog', { name: 'Zoomed product photo' });
    await expect(zoom).toBeVisible();
    await zoom.getByRole('button', { name: /Close/ }).click();
    await expect(zoom).toHaveCount(0);
    // adding without a size shows a validation message
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect(page.getByText('Please choose a size.')).toBeVisible();
    // click the visible size label, as a shopper would; the native radio underneath must become checked
    await page.locator('label').filter({ hasText: /^12 oz$/ }).click();
    await expect(page.getByRole('radio', { name: '12 oz' })).toBeChecked();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect.poll(() => cartCount(page)).toBe(1);

    await page.goto('/cart');
    await expect(page.getByRole('link', { name: /Giant 2.0/ }).first()).toBeVisible();
    const subtotal = page.locator('aside dd').first();
    await expect(subtotal).toContainText('249.99');
    await page.getByRole('button', { name: 'Increase quantity' }).first().click();
    await expect(subtotal).toContainText('499.98');
    await page.getByRole('button', { name: /Remove Giant 2.0/ }).click();
    await expect(page.getByText('Your bag is waiting').first()).toBeVisible();
  });

  test('15: search finds products', async ({ page }) => {
    await page.goto('/search?q=venum');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('venum');
    await expect(page.locator('#listing article').first()).toBeVisible();
    const count = await page.locator('#listing article').count();
    expect(count).toBeGreaterThan(3);
  });

  test('16: category filter narrows the listing via the URL', async ({ page }) => {
    await page.goto('/football');
    const total = page.locator('#listing').getByText(/\d+ results/);
    await expect(total).toBeVisible();
    const before = Number((await total.textContent())?.match(/\d+/)?.[0]);
    await page.getByRole('button', { name: /^Filter/ }).click();
    await page.getByRole('dialog', { name: 'Filters' }).getByRole('button', { name: /^adidas/ }).click();
    await expect(page).toHaveURL(/brand=adidas/);
    await expect.poll(async () => Number((await total.textContent())?.match(/\d+/)?.[0])).toBeLessThan(before);
  });

  test('17: mobile navigation', async ({ page }) => {
    test.skip(!isMobile(page), 'mobile menu only');
    await page.goto('/search');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'Boxing', exact: true }).click();
    await expect(page).toHaveURL(/\/boxing$/);
  });

  test('18: back and forward navigation', async ({ page }) => {
    await page.goto('/swimming');
    await page.getByRole('link', { name: /Swimming goggles/ }).first().click();
    await expect(page).toHaveURL(/\/swimming\/goggles/);
    await page.goBack();
    await expect(page).toHaveURL(/\/swimming$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/swimming\/goggles/);
  });
});

test.describe('API security', () => {
  test('quote API validates input and ignores client prices', async ({ request }) => {
    const bad = await request.post('/api/cart/quote', { data: { items: [{ productId: '../etc', colorId: 'x', size: 'M', qty: 1 }] } });
    expect(bad.status()).toBe(400);
    const tooMany = await request.post('/api/cart/quote', { data: { items: [{ productId: 'arena-cobra-tri-swipe-mirror-goggles', colorId: 'standard', size: 'One size', qty: 999 }] } });
    expect(tooMany.status()).toBe(400);
    const ok = await request.post('/api/cart/quote', {
      data: { items: [{ productId: 'arena-cobra-tri-swipe-mirror-goggles', colorId: 'standard', size: 'One size', qty: 2, price: 1 }] },
    });
    expect(ok.status()).toBe(200);
    const json = await ok.json();
    expect(json.subtotal).toBe(14400);
    const cross = await request.post('/api/cart/quote', { headers: { origin: 'https://evil.example' }, data: { items: [] } });
    expect(cross.status()).toBe(403);
  });
});
