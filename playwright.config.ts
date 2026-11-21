import { defineConfig, devices } from '@playwright/test';

/**
 * Uses the Microsoft Edge already installed on Windows (no browser download).
 * Base URL defaults to the local Cloudflare preview (`npm run preview`, port 8787: the real Workers
 * runtime with the local D1 database). tests/e2e/seed.ts puts two products on sale there first.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8787';
const channel = process.env.E2E_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/seed.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // one worker: the WebGL hero is GPU-heavy and parallel browsers on one laptop GPU starve each other
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    channel,
    // a language already chosen (English), so the first-visit language picker doesn't cover the pages;
    // the picker itself is tested in smoke.spec.ts with a fresh context
    storageState: { cookies: [{ name: 'lang', value: 'en', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-portrait',
      testIgnore: /fallback\.spec\.ts/,
      use: { ...devices['Pixel 7'], channel, viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      testIgnore: /fallback\.spec\.ts/,
      use: { ...devices['Desktop Edge'], channel, viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-landscape',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Pixel 7 landscape'], channel, viewport: { width: 844, height: 390 } },
    },
    {
      name: 'tablet',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['iPad Mini'], channel, browserName: 'chromium', viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'reduced-motion',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Edge'], channel, reducedMotion: 'reduce' },
    },
    {
      name: 'no-webgl',
      testMatch: /fallback\.spec\.ts/,
      use: { ...devices['Desktop Edge'], channel, launchOptions: { args: ['--disable-3d-apis', '--disable-webgl'] } },
    },
  ],
});
