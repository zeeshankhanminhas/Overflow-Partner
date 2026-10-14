/* eslint-disable @typescript-eslint/no-require-imports */
const { test, expect } = require('@playwright/test');

// Read-only checks: NEVER submit a form, trigger an email, open an approval link,
// accept a quote, upload files, or call a payment route.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      return route.abort('blockedbyclient');
    }
    // The preview may have redirects; prevent walking into a production domain.
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      const host = url.hostname;
      const safe = host.endsWith('.vercel.app') || host.endsWith('.vercel.sh') ||
        host.endsWith('.supabase.co') || host.endsWith('.supabase.in') ||
        host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com';
      if (!safe) return route.abort('blockedbyclient');
    }
    return route.continue();
  });
});

test('public home page renders without server error', async ({ page, baseURL }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response).toBeTruthy();
  expect(response.status()).toBeLessThan(500);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
  await expect(page.locator('body')).not.toBeEmpty();
});

test('quote response rejects missing token safely', async ({ page, baseURL }) => {
  const response = await page.goto('/quote-response', { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBeLessThan(500);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
  await expect(page.getByText('Quotation response unavailable')).toBeVisible();
});

test('client portal rejects missing token safely', async ({ page, baseURL }) => {
  const response = await page.goto('/client-portal', { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBeLessThan(500);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
  await expect(page.getByRole('heading', { name: 'Portal access unavailable' })).toBeVisible();
});

test('client portal rejects forged token safely', async ({ page, baseURL }) => {
  const response = await page.goto('/client-portal?token=invalid.invalid', { waitUntil: 'domcontentloaded' });
  expect(response.status()).toBeLessThan(500);
  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
  await expect(page.getByRole('heading', { name: 'Portal access unavailable' })).toBeVisible();
});
