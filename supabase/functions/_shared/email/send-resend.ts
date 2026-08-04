import type { DeliveryResult, TransactionalEmail } from './types.ts';

export async function sendWithResend(input: {
  recipientEmail: string;
  recipientName: string;
  email: TransactionalEmail;
}): Promise<DeliveryResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL') || 'Overflow Partner <onboarding@resend.dev>';
  const replyTo = Deno.env.get('RESEND_REPLY_TO_EMAIL');
  const testRecipient = Deno.env.get('RESEND_TEST_RECIPIENT');

  if (!apiKey) {
    return { status: 'not_configured', messageId: null, error: 'RESEND_API_KEY is not configured.' };
  }

  const actualRecipient = testRecipient || input.recipientEmail;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [actualRecipient],
      reply_to: replyTo || undefined,
      subject: testRecipient ? `[TEST for ${input.recipientEmail}] ${input.email.subject}` : input.email.subject,
      html: input.email.html,
      text: input.email.text,
      tags: [
        { name: 'workflow', value: 'step-2-intake' },
        { name: 'environment', value: testRecipient ? 'test' : 'production' },
      ],
    }),
  });

  const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok) {
    return {
      status: 'failed',
      messageId: null,
      error: body.message || body.name || `Resend request failed with status ${response.status}.`,
    };
  }
  return { status: 'sent', messageId: body.id || null, error: null };
}
