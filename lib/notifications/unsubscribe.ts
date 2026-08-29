import { createHmac, timingSafeEqual } from 'crypto';

function secret() {
  return process.env.NOTIFICATION_UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || '';
}

function signature(organisationId: string, email: string) {
  const key = secret();
  if (!key) return '';
  return createHmac('sha256', key).update(`${organisationId}:${email.trim().toLowerCase()}`).digest('base64url');
}

export function createNurtureUnsubscribeToken(organisationId: string, email: string) {
  return signature(organisationId, email);
}

export function verifyNurtureUnsubscribeToken(organisationId: string, email: string, token: string) {
  const expected = signature(organisationId, email);
  if (!expected || !token || expected.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

export function nurtureUnsubscribeUrl(organisationId: string, email: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://overflow-partner.vercel.app').replace(/\/$/, '');
  const token = createNurtureUnsubscribeToken(organisationId, email);
  const query = new URLSearchParams({ organisationId, email: email.trim().toLowerCase(), token });
  return `${base}/api/notifications/unsubscribe?${query.toString()}`;
}
