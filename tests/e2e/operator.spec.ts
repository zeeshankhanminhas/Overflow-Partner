import { expect, test } from '@playwright/test';

const email = process.env.OP_E2E_EMAIL;
const password = process.env.OP_E2E_PASSWORD;

test.describe('Authenticated operator browser navigation (no business writes)', () => {
  test.skip(!email || !password, 'Supply OP_E2E_EMAIL and OP_E2E_PASSWORD for an authorised test user.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Enter Workspace' }).click();
    await expect(page).toHaveURL(/\/workspace(?:\/|\?|$)/, { timeout: 20_000 });
  });

  const pages = [
    { path: '/workspace', heading: 'What needs your attention', mobileHeading: 'Mission Control' },
    { path: '/workspace/acquisition', heading: 'Move incoming work forward.' },
    { path: '/workspace/companies', heading: 'Company register' },
    { path: '/workspace/partners', heading: 'Execution partner network' },
    { path: '/workspace/activity', heading: 'What changed across the workspace' },
  ];

  for (const destination of pages) {
    test('renders ' + destination.path + ' without a fatal error', async ({ page }) => {
      await page.goto(destination.path);
      const expectedHeading = test.info().project.name === 'mobile-chromium' && 'mobileHeading' in destination\n        ? destination.mobileHeading! : destination.heading;\n      await expect(page.getByRole('heading', { level: 1, name: expectedHeading })).toBeVisible();
      await expect(page.getByText('Application error', { exact: false })).toHaveCount(0);
      if (process.env.OP_E2E_CAPTURE_UI === '1') {
        await page.screenshot({
          path: 'test-results/visual-' + test.info().project.name + '-' + destination.path.replaceAll('/', '_') + '.png',
          fullPage: true,
        });
      }
    });
  }
});
