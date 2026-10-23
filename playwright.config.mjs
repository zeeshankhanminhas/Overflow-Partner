import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.OPOS_SMOKE_BASE_URL || 'https://overflow-partner.vercel.app';

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
