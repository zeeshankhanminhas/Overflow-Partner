import { createHmac, timingSafeEqual } from 'crypto';

const VERSION = 'v2';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signingSecret() {
  const secret = process.env.EXECUTION_LINK_SIGNING_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Execution link signing credentials are not configured.');
  return secret;
}

function signatureFor(sessionId: string) {
  return createHmac('sha256', signingSecret())
    .update(`overflow-partner:execution-session:${sessionId}`)
    .digest('base64url');
}

export function createExecutionSessionToken(sessionId: string) {
  if (!UUID_PATTERN.test(sessionId)) throw new Error('Invalid execution session ID.');
  return `${VERSION}.${sessionId}.${signatureFor(sessionId)}`;
}

export function executionSessionIdFromToken(token: string) {
  const [version, sessionId, suppliedSignature, ...rest] = String(token || '').split('.');
  if (rest.length || version !== VERSION || !sessionId || !suppliedSignature || !UUID_PATTERN.test(sessionId)) return null;

  const expectedSignature = signatureFor(sessionId);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length) return null;
  return timingSafeEqual(supplied, expected) ? sessionId : null;
}
