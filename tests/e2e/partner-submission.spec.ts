import { expect, test } from '@playwright/test';

/**
 * One-use mutation acceptance test. NEVER point at production or a shared customer record.
 * It requires an isolated environment, a separate allowlisted origin and explicit consent.
 * A valid test review token is permanently transitioned to submitted by this test.
 */
const base = process.env.OP_E2E_BASE_URL || 'http://127.0.0.1:3000';
const enabled = process.env.OP_E2E_ENVIRONMENT === 'isolated'
  && process.env.OP_E2E_TEST_DATA_CONFIRMED === '1'
  && process.env.OP_E2E_ALLOW_MUTATIONS === '1'
  && Boolean(process.env.OP_E2E_MUTATION_ORIGIN)
  && process.env.OP_E2E_MUTATION_ORIGIN === new URL(base).origin
  && Boolean(process.env.OP_E2E_PARTNER_REVIEW_URL);

test.describe('Partner submission (isolated, explicitly destructive)', () => {
  test.skip(!enabled, 'Opt in only with a disposable tenant and single-use review.');

  test('records technical feasibility and partner commercial response', async ({ page }) => {
    const target = new URL(process.env.OP_E2E_PARTNER_REVIEW_URL!);
    expect(target.origin).toBe(new URL(base).origin);
    expect(target.pathname).toMatch(/^\/partner-review\/[^/]+$/);
    await page.goto(target.pathname + target.search);

    await expect(page.getByRole('heading', { level: 1, name: 'Partner review' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Engineering context' })).toBeVisible();

    await page.locator('select[name="feasibility"]').selectOption('feasible');
    await page.locator('input[name="confidence_percent"]').fill('90');
    await page.locator('select[name="capability_confirmed"]').selectOption('true');
    await page.locator('input[name="software_capability"]').fill('SolidWorks');
    await page.locator('select[name="capacity_status"]').selectOption('available');
    await page.locator('input[name="estimated_engineering_hours"]').fill('12');
    await page.locator('input[name="estimated_lead_time_days"]').fill('5');
    await page.locator('select[name="pricing_readiness"]').selectOption('ready');
    await page.locator('input[name="commercial_price"]').fill('500.00');
    await page.locator('select[name="commercial_currency"]').selectOption('GBP');
    await page.locator('input[name="reviewer_name"]').fill('OP E2E Review');
    await page.locator('input[name="reviewer_role"]').fill('Test reviewer');
    await page.locator('input[name="declaration_checked"]').check();

    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/api/partner-review/') &&
      response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Submit technical and commercial response' }).click();
    const response = await responsePromise;
    expect(response.ok(), 'Partner submission API should accept the full declaration').toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Partner response received.' })).toBeVisible();
  });
});
