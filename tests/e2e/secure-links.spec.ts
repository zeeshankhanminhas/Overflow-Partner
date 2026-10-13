import { expect, test } from '@playwright/test';

/*
 * Opening an intake/review URL can update opened_at/status in OPOS.
 * Downloading a partner file also updates its access audit counter.
 * Do not run these against unapproved live business records.
 */
const tokenReadsAllowed =
  process.env.OP_E2E_TEST_DATA_CONFIRMED === '1' &&
  process.env.OP_E2E_ALLOW_TOKEN_OPEN === '1';

function scopedSecurePath(rawUrl: string | undefined, baseURL: string, prefix: string): string {
  if (!rawUrl) throw new Error('A dedicated test link is required for this test.');
  const target = new URL(rawUrl);
  const base = new URL(baseURL);
  if (target.origin !== base.origin || !target.pathname.startsWith(prefix + '/')) {
    throw new Error('The secure test link must be on OP_E2E_BASE_URL and use the expected route.');
  }
  return target.pathname + target.search;
}

test.describe('Dedicated customer intake link', () => {
  test.skip(!tokenReadsAllowed || !process.env.OP_E2E_INTAKE_URL,
    'Requires a dedicated test intake URL and explicit permission to record its opening.');

  test('loads a readable technical intake or submitted confirmation', async ({ page, baseURL }) => {
    const path = scopedSecurePath(process.env.OP_E2E_INTAKE_URL, baseURL!, '/intake');
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Technical intake' })).toBeVisible();
    const accepted = page.getByRole('heading', { name: 'Technical requirement submitted.' });
    const entry = page.getByRole('heading', { name: 'What work needs to be completed?' });
    await expect(accepted.or(entry)).toBeVisible();
  });
});

test.describe('Dedicated execution-partner review link', () => {
  test.skip(!tokenReadsAllowed || !process.env.OP_E2E_PARTNER_REVIEW_URL,
    'Requires a dedicated test partner review URL and explicit permission to record its opening.');

  test('shows technical review content or a submitted response', async ({ page, baseURL }) => {
    const path = scopedSecurePath(process.env.OP_E2E_PARTNER_REVIEW_URL, baseURL!, '/partner-review');
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Partner review' })).toBeVisible();
    const reviewPack = page.getByRole('heading', { name: 'Engineering context' });
    const completed = page.getByRole('heading', { name: 'Partner response received.' });
    await expect(reviewPack.or(completed)).toBeVisible();
  });

  test('shared client evidence opens through the guarded file endpoint', async ({ page, baseURL }) => {
    test.skip(process.env.OP_E2E_EXPECT_PARTNER_FILE !== '1',
      'Set OP_E2E_EXPECT_PARTNER_FILE=1 after attaching a file to a dedicated test review.');
    const path = scopedSecurePath(process.env.OP_E2E_PARTNER_REVIEW_URL, baseURL!, '/partner-review');
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Partner review' })).toBeVisible();

    const fileLink = page.getByRole('link', { name: /^Open .+/ }).first();
    await expect(fileLink).toBeVisible();
    const href = await fileLink.getAttribute('href');
    expect(href).toMatch(/^\/api\/partner-review\/[^/]+\/files\/[0-9a-f-]+$/i);

    // Do not follow the short-lived signed storage URL or copy its secret into reports.
    const response = await page.request.get(href!, { maxRedirects: 0 });
    expect(response.status(), 'Expected a signed-file download redirect').toBe(302);
  });
});
