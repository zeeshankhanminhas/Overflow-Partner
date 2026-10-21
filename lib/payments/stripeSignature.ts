import { createHmac, timingSafeEqual } from 'node:crypto';

/** Strictly verifies Stripe v1 signature and a five-minute tolerance.
 * Event contents must only be parsed after this returns true.
 */
export function validStripeSignature(
  body: string,
  header: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!secret || !header) return false;
  const pieces = header.split(',').map(part => part.trim().split('='));
  const timestamp = pieces.find(([key]) => key === 't')?.[1] || '';
  const candidates = pieces.filter(([key]) => key === 'v1').map(([,value]) => value);
  if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(Number(timestamp)) ||
      Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return false;
  const calculated = createHmac('sha256',secret).update(timestamp+'.'+body).digest('hex');
  const expected = Buffer.from(calculated,'hex');
  return candidates.some(value => {
    if (!/^[a-f0-9]{64}$/i.test(value||'')) return false;
    const actual = Buffer.from(value,'hex');
    return actual.length===expected.length && timingSafeEqual(actual,expected);
  });
}
