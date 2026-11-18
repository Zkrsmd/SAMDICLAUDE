import { defineConfig, devices } from '@playwright/test';

/**
 * Uses the Microsoft Edge already installed on Windows (no browser download).
 * Base URL defaults to the production server (`npm run build && npm start`); set E2E_BASE_URL to test dev.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const channel = process.env.E2E_CHANNEL ?? 'msedge';

export default defineConfig({
  testDir: './tests/e2e',
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
