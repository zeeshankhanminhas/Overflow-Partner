import { test, expect } from '@playwright/test';

// Non-destructive checks only. No credentials, authenticated actions, writes,
// payments, webhook events, email sends or fabricated customer tokens.
test('public homepage responds without server error', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toBeEmpty();
});

test('login page loads without a server error', async ({ page }) => {
  const response = await page.goto('/login', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toBeEmpty();
});

test('client portal fails closed without an access token', async ({ page }) => {
  await page.goto('/client-portal', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Portal access unavailable' })).toBeVisible();
  await expect(page.getByText('Project reference:')).toHaveCount(0);
});

test('quote response fails closed without an access token', async ({ page }) => {
  await page.goto('/quote-response', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Quotation response unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: /confirm acceptance/i })).toHaveCount(0);
});

test('invalid portal token exposes no client data', async ({ page }) => {
  await page.goto('/client-portal?token=invalid-smoke-token', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Portal access unavailable' })).toBeVisible();
  await expect(page.getByText('Project reference:')).toHaveCount(0);
});
