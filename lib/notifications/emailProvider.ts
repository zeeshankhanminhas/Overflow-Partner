import { renderNotificationEmail } from '@/lib/notifications/templates';
import { qaDeliveryEnvelopeRecipient } from '@/lib/qa/email-guard';

// Shared by the ordinary notification worker and the exact QA Work Order
// handoff. All successful email sends use the same Resend idempotency key.
export type OutboxRow = {
  id: string;
  event_key: string;
  category: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  template_key: string;
  payload: Record<string, unknown>;
};

export async function deliverNotificationEmail(row: OutboxRow) {
  const envelopeRecipient=qaDeliveryEnvelopeRecipient(row.recipient_email);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.');

  const { html, text } = await renderNotificationEmail(row);
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `overflow-partner-${row.id}`,
    },
    body: JSON.stringify({
      from,
      // The outbox retains the original fictional contact. Resend test-mode
      // delivery targets only the owner's verified primary test address.
      to: [envelopeRecipient],
      subject: row.subject,
      html,
      text,
      ...(Array.isArray(row.payload?.emailAttachments) ? { attachments: row.payload.emailAttachments } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
      headers: {
        'X-Overflow-Partner-Event': row.event_key,
        'X-Overflow-Partner-Outbox': row.id,
      },
    }),
  });

  const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok || !body.id) {
    throw new Error(body.message || body.name || `Resend returned HTTP ${response.status}.`);
  }
  return body.id;
}
