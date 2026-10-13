import { expect, test } from '@playwright/test';

test.describe('Unauthenticated and public browser smoke', () => {
  test('public homepage loads with OP identity', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'Homepage should return a response').not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Overflow Partner/i);
    await expect(page.locator('body')).toContainText(/Overflow Partner/i);
  });

  test('login page exposes usable labelled controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enter Workspace' })).toBeVisible();
  });

  test('anonymous users cannot view the workspace', async ({ page }) => {
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
