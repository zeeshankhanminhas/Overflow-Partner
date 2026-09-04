import { renderEmailLayout, safe } from './base-layout.ts';
import type { Step2EmailInput, TransactionalEmail } from './types.ts';

export function renderStep2Reminder(input: Step2EmailInput): TransactionalEmail {
  const expiry = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(input.expiresAt));
  const subject = 'A reminder about your engineering requirements';
  const bodyHtml = `
    <p style="margin:0 0 18px;line-height:1.65">Hello ${safe(input.recipientName)},</p>
    <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;letter-spacing:-.03em">Your secure requirements form is still open</h1>
    <p style="margin:0 0 16px;line-height:1.65">We have your initial enquiry, but we still need the outstanding engineering details before we can complete our assessment.</p>
    <p style="margin:0 0 20px;line-height:1.65">Please use the secure form to provide the scope, expected deliverables, available files and required timescale. If the requirement has changed or is no longer active, reply to this email and we will update our records.</p>
    <p style="margin:0 0 8px;line-height:1.65"><strong>Company:</strong> ${safe(input.companyName)}</p>
    <p style="margin:0 0 26px;line-height:1.65"><strong>Form available until:</strong> ${expiry}</p>
    <a href="${safe(input.intakeUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:15px 22px;font-weight:700">Continue secure requirements form →</a>
    <p style="margin:26px 0 16px;font-size:13px;line-height:1.6;color:#6f6b63">If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${safe(input.intakeUrl)}</span></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6f6b63">Completing the form does not create a project or commit either party to proceed.</p>`;
  const bodyText = `Hello ${input.recipientName},\n\nYour secure requirements form is still open\n\nWe have your initial enquiry, but we still need the outstanding engineering details before we can complete our assessment.\n\nPlease use the secure form to provide the scope, expected deliverables, available files and required timescale. If the requirement has changed or is no longer active, reply to this email and we will update our records.\n\nCompany: ${input.companyName}\nForm available until: ${expiry}\n\nContinue the secure requirements form:\n${input.intakeUrl}\n\nCompleting the form does not create a project or commit either party to proceed.`;
  return { ...renderEmailLayout({ preview: 'Your secure requirements form is still open.', heading: subject, bodyHtml, bodyText }), subject };
}
