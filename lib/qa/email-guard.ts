/** QA-only outbound recipient gate. Never relax to a domain-wide allowlist.
 * Applies to every Preview send and enqueue, not to production delivery.
 */
import { isKnownIsolatedQaBackend, isKnownIsolatedQaFixtureBackend } from '@/lib/qa/isolation';

export function qaAllowedRecipientAddresses(): ReadonlySet<string> {
  if (!isKnownIsolatedQaBackend() && !isKnownIsolatedQaFixtureBackend()) return new Set();
  const base = String(process.env.OP_QA_TEST_INBOX || '').trim().toLowerCase();
  const match = /^([a-z0-9._%-]+)@gmail\.com$/.exec(base);
  if (!match) return new Set();
  const local = match[1];
  return new Set([base, `${local}+client@gmail.com`, `${local}+partner@gmail.com`]);
}

export function isQaRecipientAllowed(email: string): boolean {
  if (process.env.VERCEL_ENV !== 'preview') return true;
  const recipient = String(email || '').trim().toLowerCase();
  return qaAllowedRecipientAddresses().has(recipient);
}

export function assertQaRecipientAllowed(email: string): void {
  if (!isQaRecipientAllowed(email)) {
    throw new Error('OPOS-QA email blocked: recipient is not in the isolated test inbox allowlist.');
  }
}
