import { expect, test } from '@playwright/test';
import { cartCount, isMobile, openHome } from './helpers';
import { ON_SALE, resetRateLimits } from './seed';

/** Two products are put on sale in the local database before the run (seed.ts); everything else is "Coming soon". */
const WHISTLE = ON_SALE.whistle.slug;
const GLOVES = ON_SALE.gloves.slug;

test.describe('core shopping journeys', () => {
  test('1–5: homepage, switch sports, scroll down', async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole('heading', { level: 1, name: /REVO/ })).toBeAttached();
    const current = page.getByRole('group', { name: 'Choose sport' }).locator('[aria-current="true"]');
    await page.getByTestId('hero-stage').hover({ position: { x: 40, y: 300 } });
    const order = ['Football', 'Boxing', 'Swimming', 'Fitness', 'Martial arts', 'Basketball', 'Fishing'];
    for (let n = 0; n < 2; n++) {
      const now = (await current.getAttribute('aria-label')) ?? 'Football';
      const want = order[(order.indexOf(now) + 1) % order.length]!;
      await page.getByRole('button', { name: 'Next sport' }).click();
      await expect(current).toHaveAttribute('aria-label', want);
      await expect(page.getByRole('link', { name: new RegExp(`Explore ${want}`, 'i') })).toBeVisible();
    }
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.1));
    await expect(page.getByRole('heading', { name: /Pick your/i })).toBeInViewport({ timeout: 15_000 });
  });

  test('quick add: one size goes straight in, sized products ask for a size', async ({ page }) => {
    await page.goto('/football/referee');
    const before = await cartCount(page);
    await page.getByRole('button', { name: /^Add Fox 40 Classic whistle to bag$/ }).click();
    await expect.poll(() => cartCount(page)).toBe(before + 1);
    await page.goto('/boxing/gloves');
    const listing = page.locator('#listing');
    await listing.getByRole('button', { name: /^Add Venum boxing gloves — black \/ gold to bag$/ }).click();
    const sheet = listing.getByRole('group', { name: /Choose a size for Venum boxing gloves — black/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: '12 oz' }).click();
    await expect.poll(() => cartCount(page)).toBe(before + 2);
  });

  test('6–9: football category → boots → product detail', async ({ page }) => {
    await page.goto('/football');
    await expect(page.getByRole('heading', { level: 1, name: 'Football' })).toBeVisible();
    await page.getByRole('link', { name: /Football boots/ }).first().click();
    await expect(page).toHaveURL(/\/football\/boots/);
    const first = page.locator('#listing .pcard a[href^="/product/"]').first();
    const href = await first.getAttribute('href');
    await first.click();
    await expect(page).toHaveURL(new RegExp(href!));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('10–14: zoom, size, add to bag, update quantity, remove', async ({ page }) => {
    await page.goto(`/product/${GLOVES}`);
    await page.getByRole('button', { name: 'Zoom into the product photo' }).click();
    const zoom = page.getByRole('dialog', { name: 'Zoomed product photo' });
    await expect(zoom).toBeVisible();
    await zoom.getByRole('button', { name: /Close/ }).click();
    await expect(zoom).toHaveCount(0);
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect(page.getByText('Please choose a size.')).toBeVisible();
    await page.locator('label').filter({ hasText: /^12 oz$/ }).click();
    await expect(page.getByRole('radio', { name: '12 oz' })).toBeChecked();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect.poll(() => cartCount(page)).toBe(1);

    await page.goto('/cart');
    const subtotal = page.locator('aside dd').first();
    await expect(subtotal).toContainText(/4\s300\sDA/);
    await page.getByRole('button', { name: 'Increase quantity' }).first().click();
    await expect(subtotal).toContainText(/8\s600\sDA/);
    await page.getByRole('button', { name: /Remove Venum boxing gloves/ }).click();
    await expect(page.getByText('Your bag is waiting').first()).toBeVisible();
  });

  test('coming soon products are shown but not sold', async ({ page }) => {
    await page.goto('/product/psg-2026-27-home-jersey');
    await expect(page.getByRole('heading', { level: 1, name: /PSG 2026\/27 home jersey/ })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Coming soon' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to bag' })).toHaveCount(0);
    await page.goto('/football/jerseys');
    await expect(page.locator('.pcard[data-availability="soon"]').first()).toBeVisible();
  });

  test('15: search finds products', async ({ page }) => {
    await page.goto('/search?q=venum');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('venum');
    await expect(page.locator('#listing article').first()).toBeVisible();
    expect(await page.locator('#listing article').count()).toBeGreaterThan(3);
  });

  test('16: category filter narrows the listing via the URL; long lists page with "Show more"', async ({ page }) => {
    await page.goto('/football');
    const total = page.locator('#listing').getByText(/\d+ results/);
    await expect(total).toBeVisible();
    const before = Number((await total.textContent())?.match(/\d+/)?.[0]);
    expect(await page.locator('#listing .pcard').count()).toBeLessThanOrEqual(48);
    await expect(page.getByTestId('listing-more')).toBeVisible();
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
  test('quote API validates input, ignores client prices and refuses coming-soon products', async ({ request }) => {
    const bad = await request.post('/api/cart/quote', { data: { items: [{ productId: '../etc', colorId: 'x', size: 'M', qty: 1 }] } });
    expect(bad.status()).toBe(400);
    const tooMany = await request.post('/api/cart/quote', { data: { items: [{ productId: WHISTLE, colorId: 'standard', size: 'One size', qty: 999 }] } });
    expect(tooMany.status()).toBe(400);
    const ok = await request.post('/api/cart/quote', { data: { items: [{ productId: WHISTLE, colorId: 'standard', size: 'One size', qty: 2, price: 1 }] } });
    expect(ok.status()).toBe(200);
    // centimes: 2 × 980 DA (the client's "price: 1" is ignored)
    expect((await ok.json()).subtotal).toBe(196_000);
    const soon = await request.post('/api/cart/quote', { data: { items: [{ productId: 'psg-2026-27-home-jersey', colorId: 'standard', size: 'M', qty: 1 }] } });
    expect((await soon.json()).rejected[0].reason).toMatch(/Coming soon/);
    const cross = await request.post('/api/cart/quote', { headers: { origin: 'https://evil.example' }, data: { items: [] } });
    expect(cross.status()).toBe(403);
  });
});

test.describe('cash on delivery checkout', () => {
  test('asks for the details, prices delivery by wilaya, and adds it to the total (no order placed)', async ({ page }) => {
    await page.goto(`/product/${WHISTLE}`);
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await expect.poll(() => cartCount(page)).toBe(1);
    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm order' }).click();
    await expect(page.getByText('Enter your first and last name')).toBeVisible();
    await expect(page.getByText(/Enter a mobile number/)).toBeVisible();
    await expect(page.getByText('Choose your wilaya').last()).toBeVisible();
    // Alger: 980 DA + 650 DA home delivery, or 470 DA at the stop desk
    await page.locator('#co-wilaya').selectOption('16');
    await expect(page.getByTestId('co-total')).toHaveText(/1\s630\sDA/);
    await page.locator('label').filter({ hasText: 'Stop desk' }).click();
    await expect(page.getByTestId('co-total')).toHaveText(/1\s450\sDA/);
    // a stop-desk parcel needs no street address; we always confirm by calling (no SMS option)
    await expect(page.locator('#co-address')).toHaveCount(0);
    await expect(page.getByText('We call you within about an hour')).toBeVisible();
    await expect(page.getByText('Send me an SMS')).toHaveCount(0);
  });
});

test.describe('orders and receipts', () => {
  const order = {
    firstName: 'Test',
    lastName: 'Client',
    phone: '0555 12 34 56',
    wilaya: 16,
    commune: 'Bab Ezzouar',
    address: 'Cité test, bloc 1',
    method: 'home',
    confirm: 'call',
    note: 'e2e test order',
    items: [{ productId: WHISTLE, colorId: 'standard', size: 'One size', qty: 1 }],
  };

  test('validates the form, refuses other sites and coming-soon items, drops bot orders', async ({ request }) => {
    const badPhone = await request.post('/api/orders', { data: { ...order, phone: '0212 34' } });
    expect(badPhone.status()).toBe(400);
    expect((await badPhone.json()).fields.phone).toMatch(/mobile number/);
    const noDesk = await request.post('/api/orders', { data: { ...order, wilaya: 57, method: 'desk' } });
    expect(noDesk.status()).toBe(400);
    const cross = await request.post('/api/orders', { headers: { origin: 'https://evil.example' }, data: order });
    expect(cross.status()).toBe(403);
    const soon = await request.post('/api/orders', { data: { ...order, items: [{ productId: 'psg-2026-27-home-jersey', colorId: 'standard', size: 'M', qty: 1 }] } });
    expect(soon.status()).toBe(409);
    const bot = await request.post('/api/orders', { data: { ...order, website: 'http://spam.example' } });
    expect(bot.status()).toBe(202);
    expect((await bot.json()).receipt).toBeUndefined();
  });

  test('a placed order gets a private receipt link; other links show nothing', async ({ request, page }, info) => {
    test.skip(info.project.name !== 'desktop', 'places a real order: once, on desktop');
    const res = await request.post('/api/orders', { data: order });
    expect(res.status()).toBe(201);
    const json = (await res.json()) as { number: number; receipt: string };
    expect(json.receipt).toMatch(/^\/order\/[A-Za-z0-9_-]{43}$/);
    await page.goto(json.receipt);
    await expect(page.getByRole('heading', { name: 'Your receipt' })).toBeVisible();
    await expect(page.getByText(`Order #${json.number}`)).toBeVisible();
    await expect(page.getByTestId('receipt-total')).toHaveText(/1\s630\sDA/);
    // the full phone number is not on the page
    await expect(page.getByText('0555123456')).toHaveCount(0);
    // a guessed or altered link shows nothing
    const wrong = await page.goto(json.receipt.slice(0, -2) + (json.receipt.endsWith('AA') ? 'BB' : 'AA'));
    expect(wrong?.status()).toBe(404);
    expect((await page.goto(`/order/${json.number}`))?.status()).toBe(404);
    // receipts are never cached or indexed
    const head = await request.get(json.receipt);
    expect(head.headers()['cache-control']).toContain('no-store');
    expect(head.headers()['x-robots-tag']).toContain('noindex');
  });
});

test.describe('buy from the product page', () => {
  test('two sizes added one after the other are ordered together, then the bag empties', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'places a real order: once, on desktop');
    // earlier tests placed orders from this same connection: start from a clean order limit
    resetRateLimits();
    await page.goto(`/product/${ON_SALE.gloves.slug}`);
    const add = page.getByRole('button', { name: 'Add to bag' }).first();
    await page.locator('label').filter({ hasText: /^12 oz$/ }).click();
    await add.click();
    await expect(add).toHaveAttribute('data-state', 'done');
    await page.locator('label').filter({ hasText: /^14 oz$/ }).click();
    await add.click();
    await expect.poll(() => cartCount(page)).toBe(2);

    const form = page.getByTestId('quickbuy');
    await form.getByLabel('Full name').fill('Quick Buyer');
    await form.getByLabel('Phone number').fill('0770 11 22 33');
    await form.getByLabel('Wilaya').selectOption('16');
    await form.getByLabel('Commune').fill('Hydra');
    await form.getByLabel('Address').fill('Rue test 3');
    const lines = form.getByTestId('qb-lines');
    await expect(lines).toContainText('12 oz');
    await expect(lines).toContainText('14 oz');
    // Alger home delivery: 2 × 4 300 + 650 DA
    await expect(form.getByTestId('qb-total')).toHaveText(/9\s250\sDA/);
    await form.getByRole('button', { name: 'Order now' }).click();
    const done = page.getByTestId('quickbuy-done');
    await expect(done).toBeVisible();
    await expect(done).toContainText(/Order #\d+/);
    await expect.poll(() => cartCount(page)).toBe(0);
  });
});
