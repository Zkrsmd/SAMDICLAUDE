import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { openHome } from './helpers';
import { ON_SALE } from './seed';

/** The preview's admin password: E2E_ADMIN_PASSWORD, or the local test password in .dev.vars (never the real one). */
function adminPassword() {
  if (process.env.E2E_ADMIN_PASSWORD) return process.env.E2E_ADMIN_PASSWORD;
  try {
    return fs.readFileSync(path.join(process.cwd(), '.dev.vars'), 'utf8').match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}
/** prices print with no-break spaces: "39 900 DA" */
const NBSP = String.fromCharCode(160);
const SLUG = ON_SALE.whistle.slug;

async function signIn(page: import('@playwright/test').Page, pw: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Password').fill(pw);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test('shop by sport opens a sport in place, with best sellers, new releases and see all', async ({ page }) => {
  await openHome(page);
  const tile = page.getByRole('button', { name: /^Boxing, \d+ products$/ });
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(tile).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByRole('region', { name: 'Boxing shop' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: /Best sellers/ })).toBeVisible();
  await expect(panel.getByRole('heading', { name: /New releases/ })).toBeAttached();
  await expect(page).toHaveURL(/[?&]sport=boxing/);
  const all = panel.locator('section[aria-labelledby="sp-all"] .pcard');
  const before = await all.count();
  await panel.getByRole('button', { name: /^See all \d+/ }).click();
  await expect.poll(() => all.count()).toBeGreaterThan(before);
  // a category chip narrows the list in place
  await panel.getByRole('button', { name: /^Boxing gloves \d+$/ }).click();
  await expect(panel.getByRole('heading', { name: /All boxing/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Close Boxing' }).click();
  await expect(panel).toBeHidden();
  await expect(page).not.toHaveURL(/sport=/);
});

test.describe('admin', () => {
  test('is locked: pages send you to sign in, the APIs refuse, a wrong password is rejected', async ({ page, request }) => {
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await request.get('/api/admin/export')).status()).toBe(401);
    const upload = await request.post('/api/admin/media', { headers: { origin: new URL(page.url()).origin }, multipart: { slug: SLUG, slot: '1' } });
    expect(upload.status()).toBe(401);
    if (!adminPassword()) return;
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#adm-pw-error')).toContainText('not right');
  });

  test('edit a product: the was-price shows in the store, then put it back', async ({ page }, info) => {
    const pw = adminPassword();
    test.skip(!pw, 'no admin password for the preview');
    test.skip(info.project.name !== 'desktop', 'writes run once, on desktop');
    await signIn(page, pw!);
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();
    await page.goto(`/admin/products/${SLUG}`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(/Fox 40 Classic whistle/);
    await page.getByLabel('Compare-at price').fill('1500');
    await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Product saved')).toBeVisible();
    await page.goto(`/product/${SLUG}`);
    await expect(page.getByLabel(`Was 1${NBSP}500${NBSP}DA`).first()).toBeVisible();

    await page.goto(`/admin/products/${SLUG}`);
    await page.getByLabel('Compare-at price').fill('');
    await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Product saved')).toBeVisible();
    await page.goto(`/product/${SLUG}`);
    await expect(page.getByLabel(`Was 1${NBSP}500${NBSP}DA`)).toHaveCount(0);
  });

  test('coming soon: switched on in the admin, the store shows it and won’t sell it; then put it back', async ({ page }, info) => {
    const pw = adminPassword();
    test.skip(!pw, 'no admin password for the preview');
    test.skip(info.project.name !== 'desktop', 'writes run once, on desktop');
    await signIn(page, pw!);
    await page.goto(`/admin/products/${SLUG}`);
    await page.getByRole('switch', { name: 'Coming soon' }).click();
    await expect(page.getByTestId('store-availability')).toContainText('Coming soon');
    await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Product saved')).toBeVisible();

    await page.goto(`/product/${SLUG}`);
    await expect(page.getByRole('status').filter({ hasText: 'Coming soon' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to bag' })).toHaveCount(0);
    const quote = await page.request.post('/api/cart/quote', { data: { items: [{ productId: SLUG, colorId: 'standard', size: 'One size', qty: 1 }] } });
    expect((await quote.json()).rejected[0].reason).toMatch(/Coming soon/);

    await page.goto(`/admin/products/${SLUG}`);
    await page.getByRole('switch', { name: 'Coming soon' }).click();
    await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Product saved')).toBeVisible();
    await page.goto(`/product/${SLUG}`);
    await expect(page.getByRole('button', { name: 'Add to bag' }).first()).toBeVisible();
  });

  test('orders: the admin sees a placed order with the customer’s details', async ({ page, request }, info) => {
    const pw = adminPassword();
    test.skip(!pw, 'no admin password for the preview');
    test.skip(info.project.name !== 'desktop', 'writes run once, on desktop');
    const res = await request.post('/api/orders', {
      data: { firstName: 'Admin', lastName: 'Check', phone: '0661 22 33 44', wilaya: 31, commune: 'Bir El Djir', address: 'Rue test 2', method: 'desk', confirm: 'sms', note: 'e2e admin check', items: [{ productId: SLUG, colorId: 'standard', size: 'One size', qty: 2 }] },
    });
    expect(res.status()).toBe(201);
    const { number } = (await res.json()) as { number: number };
    await signIn(page, pw!);
    await page.goto(`/admin/orders/w${number}`);
    await expect(page.getByText('0661 22 33 44').first()).toBeVisible();
    await expect(page.getByTestId('confirm-by')).toContainText(/SMS/i);
    await expect(page.getByTestId('print-receipt')).toHaveAttribute('href', `/admin/print/w${number}`);
    // the order's road: confirm → prepare → ship
    await page.getByRole('button', { name: 'Confirmed on the phone' }).click();
    await expect(page.getByRole('button', { name: 'Start preparing' })).toBeVisible();
    await page.getByRole('button', { name: 'Start preparing' }).click();
    await expect(page.getByRole('button', { name: 'Hand to the courier' })).toBeVisible();
    await expect(page.getByLabel('Change the order status')).toHaveValue('preparing');
    // any status from the list
    await page.getByLabel('Change the order status').selectOption('no_answer');
    await expect(page.getByTestId('status-hint')).toContainText('No answer');
    // the printable receipt
    await page.goto(`/admin/print/w${number}`);
    await expect(page.getByText('Bon de commande')).toBeVisible();
    await expect(page.getByText(`${number}`, { exact: true })).toBeVisible();
    await expect(page.getByText('Total à payer')).toBeVisible();
  });
});
