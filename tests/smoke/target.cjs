// Never point smoke tests at the production domain or an arbitrary third-party host.
// These tests intentionally perform GET requests only.
function assertSafeTarget(value) {
  if (!value) throw new Error('OPOS_TEST_BASE_URL is required: use a dedicated Vercel preview deployment.');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('OPOS_TEST_BASE_URL must be an absolute HTTPS URL.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.port) {
    throw new Error('Test target must be a clean HTTPS origin.');
  }
  if (!/^overflow-partner-[a-z0-9]+-zeeshankhanminhas-projects\.vercel\.app$/.test(parsed.hostname)) {
    throw new Error('Refusing test run: target must be an isolated Overflow Partner preview deployment, not production.');
  }
  return parsed.origin;
}
module.exports = { assertSafeTarget };
