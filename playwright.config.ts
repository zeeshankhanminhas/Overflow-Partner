import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.OP_E2E_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: true,
    screenshot: process.env.OP_E2E_SAFE_LOGS_ONLY === '1' ? 'off' : 'only-on-failure',
    video: process.env.OP_E2E_SAFE_LOGS_ONLY === '1' ? 'off' : 'retain-on-failure',
    trace: process.env.OP_E2E_SAFE_LOGS_ONLY === '1' ? 'off' : 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
