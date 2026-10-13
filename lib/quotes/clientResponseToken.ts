import { createHmac, timingSafeEqual } from 'node:crypto';

export type ClientQuoteResponse = 'accepted' | 'declined' | 'more_time';
type TokenPayload = { quoteId: string; revision: number; response: ClientQuoteResponse; exp: number };

function secret() {
  const value = process.env.QUOTE_RESPONSE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Quote response signing key is not configured.');
  return value;
}

export function createClientResponseToken(payload: TokenPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyClientResponseToken(token: string): TokenPayload | null {
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = createHmac('sha256', secret()).update(encoded).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload.quoteId || !Number.isInteger(payload.revision) || !['accepted', 'declined', 'more_time'].includes(payload.response) || !Number.isInteger(payload.exp) || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
