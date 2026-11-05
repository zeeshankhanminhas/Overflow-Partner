/**
 * Isolated QA, read-only credential smoke test at build time.
 * Never prints, exposes, caches or forwards a Supabase secret beyond its own QA origin.
 * All production/non-QA deploys skip this test.
 */
const qaRef = String(process.env.OP_QA_SUPABASE_PROJECT_REF || '').trim().toLowerCase();
const branch = process.env.VERCEL_GIT_COMMIT_REF || '';
const isQaBuild = process.env.VERCEL_ENV === 'preview' &&
  branch === 'design/opos-decision-first-ia' &&
  process.env.OP_QA_FIXTURE_WRITES_ENABLED === 'true';

if (!isQaBuild) {
  console.log('Isolated QA service credential smoke: skipped (non-QA build)');
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const expectedProject = 'ukcamenuxhdznxaxpyis';
  const expectedOrganisation = '717262cb-68da-4e7b-a9fa-238dc6c5d16b';
  if (qaRef !== expectedProject || !secret || !url ||
      url !== 'https://' + expectedProject + '.supabase.co') {
    throw new Error('Isolated QA service credential check: missing QA-only configuration');
  }
  const response = await fetch(url + '/rest/v1/organisations?select=id&id=eq.' + expectedOrganisation, {
    headers: { apikey: secret, Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Isolated QA service credential check failed (HTTP ' + response.status + ')');
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id !== expectedOrganisation) {
    throw new Error('Isolated QA service credential check failed: expected organisation was not accessible');
  }
  console.log('Isolated QA service credential smoke: PASS (QA organisation read-only)');
}
