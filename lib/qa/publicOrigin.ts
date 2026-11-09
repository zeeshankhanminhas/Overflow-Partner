/** Trusted QA entry point shared by client portal emails and Stripe return URLs.
 * Never use this origin for production; do not accept arbitrary user-supplied URLs.
 */
export function validatedQaOrigin(value: string, branchUrl?: string): string {
  if (!value) throw new Error('Stable QA public origin is not configured.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Stable QA public origin is invalid.'); }
  if (
    url.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.vercel\.app$/i.test(url.hostname) ||
    url.port || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash ||
    value.replace(/\/$/, '') !== url.origin
  ) throw new Error('Stable QA public origin must be a clean Vercel HTTPS hostname.');

  // Vercel's automatically assigned branch domain is authoritative when exposed.
  if (branchUrl && branchUrl.toLowerCase() !== url.hostname.toLowerCase())
    throw new Error('Stable QA origin does not match the preview branch alias.');
  return url.origin;
}

export function qaPublicOrigin(): string {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.OP_ISOLATED_QA_BACKEND !== 'true')
    throw new Error('Stable QA public origin cannot be used outside isolated preview.');
  return validatedQaOrigin(
    process.env.OP_QA_PUBLIC_ORIGIN || (process.env.VERCEL_BRANCH_URL ? 'https://' + process.env.VERCEL_BRANCH_URL : ''),
    process.env.VERCEL_BRANCH_URL || undefined
  );
}
