/* eslint-disable @typescript-eslint/no-require-imports */
const { defineConfig, devices } = require('@playwright/test');
const { assertSafeTarget } = require('./tests/smoke/target.cjs');
const baseURL = assertSafeTarget(process.env.OPOS_TEST_BASE_URL);
module.exports = defineConfig({
  testDir: './tests/smoke',
  testMatch: '**/*.spec.cjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 10000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
});
