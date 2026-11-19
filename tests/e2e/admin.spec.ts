import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { openHome } from './helpers';

/** ADMIN_PASSWORD from the environment, or from .env.local when the tests run on the dev machine. */
function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  try {
    return fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
  } catch {
    return undefined;
  }
}
const STORE = path.join(process.cwd(), 'src', 'data', 'store', 'overrides.json');

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
  await panel.getByRole('button', { name: /^Boxing gloves/ }).click();
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
    const upload = await request.post('/api/admin/media', { headers: { origin: new URL(page.url()).origin }, multipart: { slug: 'nike-control-soccer-ball', slot: '1' } });
    expect(upload.status()).toBe(401);
    if (!adminPassword()) return;
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('#adm-pw-error')).toContainText('not right');
  });

  test('edit a product: the sale price shows in the store, then put it back', async ({ page }, info) => {
    const pw = adminPassword();
    test.skip(!pw, 'ADMIN_PASSWORD is not set');
    // the store file is shared: change it from one project only, and restore it afterwards
    test.skip(info.project.name !== 'desktop', 'writes run once, on desktop');
    const original = fs.readFileSync(STORE, 'utf8');
    try {
      await page.goto('/admin/login');
      await page.getByLabel('Password').fill(pw!);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeVisible();

      await page.goto('/admin/products?q=control+soccer');
      await page.getByRole('link', { name: /Control Soccer Ball/ }).first().click();
      await expect(page.getByLabel('Title', { exact: true })).toHaveValue(/Control Soccer Ball/);
      await page.getByLabel('Compare-at price').fill('199.00');
      await expect(page.getByRole('region', { name: 'Unsaved changes' })).toBeVisible();
      await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Product saved')).toBeVisible();

      await page.goto('/product/nike-control-soccer-ball');
      await expect(page.getByLabel('Was $199.00').first()).toBeVisible();

      await page.goto('/admin/products/nike-control-soccer-ball');
      await page.getByLabel('Compare-at price').fill('');
      await page.getByRole('region', { name: 'Unsaved changes' }).getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Product saved')).toBeVisible();
      await page.goto('/product/nike-control-soccer-ball');
      await expect(page.getByLabel('Was $199.00')).toHaveCount(0);
    } finally {
      fs.writeFileSync(STORE, original);
    }
  });
});
