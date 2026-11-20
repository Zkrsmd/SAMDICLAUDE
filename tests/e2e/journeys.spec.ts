import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { cartCount, isMobile, openHome } from './helpers';

test.describe('core shopping journeys', () => {
  test('1–5: homepage, skip loader, switch sports, scroll down', async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole('heading', { level: 1, name: /SMADI/ })).toBeAttached();
    const current = page.getByRole('group', { name: 'Choose sport' }).locator('[aria-current="true"]');
    // hovering the stage pauses the autoplay, so only our clicks change the sport
    await page.getByTestId('hero-stage').hover({ position: { x: 40, y: 300 } });
    const order = ['Football', 'Boxing', 'Swimming', 'Basketball'];
    for (let n = 0; n < 2; n++) {
      const now = (await current.getAttribute('aria-label')) ?? 'Football';
      const want = order[(order.indexOf(now) + 1) % order.length]!;
      await page.getByRole('button', { name: 'Next sport' }).click();
      await expect(current).toHaveAttribute('aria-label', want);
      await expect(page.getByRole('link', { name: new RegExp(`Explore ${want}`, 'i') })).toBeVisible();
    }
    // native vertical scroll must pass straight through the hero (no scroll trap)
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.1));
    await expect(page.getByRole('heading', { name: /brands behind the performance/i })).toBeInViewport({ timeout: 15_000 });
  });

  test('quick add: the + on a homepage object puts it in the bag (size sheet when needed)', async ({ page }) => {
    await openHome(page);
    const before = await cartCount(page);
    const icons = page.locator('section[aria-labelledby="best-title"]');
    await icons.scrollIntoViewIfNeeded();
    // goggles come in one size: the + adds straight away
    await icons.getByRole('button', { name: /^Add Fastskin Speed Socket.* to bag$/ }).click();
    await expect.poll(() => cartCount(page)).toBe(before + 1);
    // boots need a size: the + opens a size sheet first
    await icons.getByRole('button', { name: /^Add Mercurial Vapor.* to bag$/ }).click();
    const sheet = icons.getByRole('group', { name: /Choose a size for Mercurial Vapor/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'UK 9' }).click();
    await expect(sheet).toHaveCount(0);
    await expect.poll(() => cartCount(page)).toBe(before + 2);
  });

  test('6–9: football category → boot wall → product detail', async ({ page }) => {
    await openHome(page);
    await page.getByRole('group', { name: 'Choose sport' }).getByRole('button', { name: 'Football' }).click();
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
    // prices are in dinars ($249.99 demo list price × 250, rounded to 100 DA)
    await expect(subtotal).toContainText(/62\s500\sDA/);
    await page.getByRole('button', { name: 'Increase quantity' }).first().click();
    await expect(subtotal).toContainText(/125\s000\sDA/);
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
    // centimes: 2 × 18 000 DA (the client's "price: 1" is ignored)
    expect(json.subtotal).toBe(3_600_000);
    const cross = await request.post('/api/cart/quote', { headers: { origin: 'https://evil.example' }, data: { items: [] } });
    expect(cross.status()).toBe(403);
  });
});

test.describe('cash on delivery checkout', () => {
  test('asks for the details, prices delivery by wilaya, and adds it to the total (no order placed)', async ({ page }) => {
    // one size: no size to pick
    await page.goto('/product/arena-cobra-tri-swipe-mirror-goggles');
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect.poll(() => cartCount(page)).toBe(1);
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    // nothing filled in: each field says what's missing
    await page.getByRole('button', { name: 'Confirm order' }).click();
    await expect(page.getByText('Enter your first name')).toBeVisible();
    await expect(page.getByText(/Enter a mobile number/)).toBeVisible();
    await expect(page.getByText('Choose your wilaya').last()).toBeVisible();
    // Alger: 18 000 DA goggles + 650 DA home delivery, or 470 DA at the stop desk
    await page.locator('#co-wilaya').selectOption('16');
    await expect(page.getByTestId('co-total')).toHaveText(/18\s650\sDA/);
    await page.locator('label').filter({ hasText: 'Stop desk' }).click();
    await expect(page.getByTestId('co-total')).toHaveText(/18\s470\sDA/);
    // both ways to confirm are offered
    await expect(page.getByText('We call you within about an hour')).toBeVisible();
    await page.locator('label').filter({ hasText: 'Send me an SMS' }).click();
    await expect(page.getByText('We’ll text you to confirm.')).toBeVisible();
  });
});

test.describe('orders API', () => {
  const ORDERS = path.join(process.cwd(), '.data', 'orders.json');
  const count = () => (fs.existsSync(ORDERS) ? JSON.parse(fs.readFileSync(ORDERS, 'utf8')).orders.length : 0);
  const order = {
    firstName: 'Test',
    lastName: 'Client',
    phone: '0555 12 34 56',
    wilaya: 16,
    commune: 'Bab Ezzouar',
    address: 'Cité test, bloc 1',
    method: 'home',
    confirm: 'call',
    note: '',
    items: [{ productId: 'speedo-fastskin-cap-pink', colorId: 'standard', size: 'M', qty: 1 }],
  };
  test('validates the form, refuses other sites, and drops bot orders without saving', async ({ request }) => {
    const before = count();
    const badPhone = await request.post('/api/orders', { data: { ...order, phone: '0212 34' } });
    expect(badPhone.status()).toBe(400);
    expect((await badPhone.json()).fields.phone).toMatch(/mobile number/);
    const noDesk = await request.post('/api/orders', { data: { ...order, wilaya: 57, method: 'desk' } });
    expect(noDesk.status()).toBe(400);
    const cross = await request.post('/api/orders', { headers: { origin: 'https://evil.example' }, data: order });
    expect(cross.status()).toBe(403);
    // the hidden honeypot field filled in: answered like a success, nothing saved
    const bot = await request.post('/api/orders', { data: { ...order, website: 'http://spam.example' } });
    expect(bot.status()).toBe(202);
    expect(count()).toBe(before);
  });
});
