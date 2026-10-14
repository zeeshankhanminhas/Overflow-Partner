import { createHmac, timingSafeEqual } from 'node:crypto';

type PortalPayload = { purpose: 'client_quote_portal'; quoteId: string; revision: number; exp: number };
const lifetime = 90 * 24 * 60 * 60 * 1000;
function key() {
  const secret = process.env.QUOTE_RESPONSE_SECRET;
  if (!secret) throw new Error('Quote portal signing key is not configured.');
  return secret;
}
export function createClientPortalToken(quoteId: string, revision: number) {
  const payload: PortalPayload = { purpose: 'client_quote_portal', quoteId, revision, exp: Date.now() + lifetime };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return data + '.' + createHmac('sha256', key()).update(data).digest('base64url');
}
export function verifyClientPortalToken(token: string): PortalPayload | null {
  if (token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = createHmac('sha256', key()).update(parts[0]).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(parts[1], 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as PortalPayload;
    if (data.purpose !== 'client_quote_portal' || !/^[0-9a-f-]{36}$/i.test(data.quoteId) || !Number.isInteger(data.revision) || data.revision < 1 || !Number.isSafeInteger(data.exp) || data.exp <= Date.now()) return null;
    return data;
  } catch { return null; }
}
