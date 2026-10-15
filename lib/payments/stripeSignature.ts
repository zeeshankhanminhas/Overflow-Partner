import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyStripeSignature(payload: string, signatureHeader: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = signatureHeader.split(',').map((part) => part.split('=', 2));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value || '');
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || signatures.length === 0) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest();
  return signatures.some((signature) => {
    if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
    const supplied = Buffer.from(signature, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
