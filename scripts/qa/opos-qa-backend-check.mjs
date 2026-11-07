/**
 * Isolated QA, read-only credential smoke test at build time.
 * Never prints, exposes, caches or forwards a Supabase secret beyond its own QA origin.
 * All production/non-QA deploys skip this test.
 */
const qaRef = String(process.env.OP_QA_SUPABASE_PROJECT_REF || '').trim().toLowerCase();
const branch = process.env.VERCEL_GIT_COMMIT_REF || '';
// Verify the server credential on every authorised QA branch whenever any
// QA write gate is enabled. A READY build must not silently skip this check
// on the recovery branch (which owns the unified client review UI).
const allowedQaBranches = new Set([
  'design/opos-decision-first-ia',
  'qa/recovery-ui-client-gate-20261105',
]);
const writesEnabled = process.env.OP_QA_FIXTURE_WRITES_ENABLED === 'true' ||
  process.env.OP_ISOLATED_QA_BACKEND === 'true';
const isQaBuild = process.env.VERCEL_ENV === 'preview' &&
  allowedQaBranches.has(branch) && writesEnabled;

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
  // Legacy service_role JWTs must be sent as the Authorization bearer token.
  // Sending only apikey can leave PostgREST operating under anon RLS and
  // produce an empty 200 response even when the QA organisation exists.
  const parts = secret.split('.');
  let role;
  try {
    if (parts.length !== 3) throw new Error('Expected legacy service_role JWT');
    role = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role;
  } catch {
    throw new Error('Isolated QA service credential check: invalid legacy service-role JWT format');
  }
  if (role !== 'service_role') {
    throw new Error('Isolated QA service credential check: credential is not a service_role JWT');
  }
  const response = await fetch(url + '/rest/v1/organisations?select=id&id=eq.' + expectedOrganisation, {
    headers: { apikey: secret, Authorization: 'Bearer ' + secret, Accept: 'application/json' },
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
