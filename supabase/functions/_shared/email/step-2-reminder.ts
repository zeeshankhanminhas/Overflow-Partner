import { renderEmailLayout, safe } from './base-layout.ts';
import type { Step2EmailInput, TransactionalEmail } from './types.ts';

export function renderStep2Reminder(input: Step2EmailInput): TransactionalEmail {
  const expiry = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(input.expiresAt));
  const subject = 'Reminder: complete your engineering requirement';
  const bodyHtml = `
    <p style="margin:0 0 18px;line-height:1.65">Hello ${safe(input.recipientName)},</p>
    <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;letter-spacing:-.03em">Your technical intake is still waiting.</h1>
    <p style="margin:0 0 16px;line-height:1.65">We have your initial request for <strong>${safe(input.companyName)}</strong>, but still need the technical details before it can be reviewed.</p>
    <p style="margin:0 0 26px;line-height:1.65">Completing the intake should take only a few minutes.</p>
    <a href="${safe(input.intakeUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:15px 22px;font-weight:700">Continue technical intake →</a>
    <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#6f6b63">This secure link expires on ${expiry}.<br><span style="word-break:break-all">${safe(input.intakeUrl)}</span></p>`;
  const bodyText = `Hello ${input.recipientName},\n\nYour technical intake for ${input.companyName} is still waiting.\n\nContinue here:\n${input.intakeUrl}\n\nThis link expires on ${expiry}.`;
  return { ...renderEmailLayout({ preview: 'Your secure technical intake is still waiting.', heading: subject, bodyHtml, bodyText }), subject };
}
