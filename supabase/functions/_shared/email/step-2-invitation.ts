import { renderEmailLayout, safe } from './base-layout.ts';
import type { Step2EmailInput, TransactionalEmail } from './types.ts';

export function renderStep2Invitation(input: Step2EmailInput): TransactionalEmail {
  const expiry = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(input.expiresAt));
  const subject = 'Complete your engineering requirement — Step 2';
  const bodyHtml = `
    <p style="margin:0 0 18px;line-height:1.65">Hello ${safe(input.recipientName)},</p>
    <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;letter-spacing:-.03em">Help us understand the engineering scope.</h1>
    <p style="margin:0 0 16px;line-height:1.65">Thank you for submitting the initial requirement for <strong>${safe(input.companyName)}</strong>.</p>
    <p style="margin:0 0 8px;line-height:1.65"><strong>Project type:</strong> ${safe(input.projectType)}</p>
    <p style="margin:0 0 26px;line-height:1.65">The secure technical intake captures deliverables, formats, standards, tolerances and deadline so the work can be reviewed accurately.</p>
    <a href="${safe(input.intakeUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:15px 22px;font-weight:700">Complete technical intake →</a>
    <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#6f6b63">This secure link expires on ${expiry}. If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${safe(input.intakeUrl)}</span></p>`;
  const bodyText = `Hello ${input.recipientName},\n\nThank you for submitting the initial requirement for ${input.companyName}.\nProject type: ${input.projectType}\n\nComplete the secure technical intake here:\n${input.intakeUrl}\n\nThis link expires on ${expiry}.`;
  return { ...renderEmailLayout({ preview: 'Complete the secure technical intake for your engineering requirement.', heading: subject, bodyHtml, bodyText }), subject };
}
