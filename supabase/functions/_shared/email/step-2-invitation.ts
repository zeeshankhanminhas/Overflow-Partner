import { renderEmailLayout, safe } from './base-layout.ts';
import type { Step2EmailInput, TransactionalEmail } from './types.ts';

export function renderStep2Invitation(input: Step2EmailInput): TransactionalEmail {
  const expiry = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/London',
  }).format(new Date(input.expiresAt));
  const subject = 'Please complete your engineering requirements';
  const bodyHtml = `
    <p style="margin:0 0 18px;line-height:1.65">Hello ${safe(input.recipientName)},</p>
    <h1 style="margin:0 0 18px;font-size:28px;line-height:1.15;letter-spacing:-.03em">A few details will help us assess your requirement</h1>
    <p style="margin:0 0 16px;line-height:1.65">Please use the secure requirements form to provide the scope, expected deliverables, available files and required timescale.</p>
    <p style="margin:0 0 16px;line-height:1.65">We will use this information to assess technical feasibility, identify any important gaps and establish the basis for delivery review and pricing.</p>
    <p style="margin:0 0 20px;line-height:1.65">Completing this form does not create a project or commit either party to proceed.</p>
    <p style="margin:0 0 8px;line-height:1.65"><strong>Company:</strong> ${safe(input.companyName)}</p>
    <p style="margin:0 0 26px;line-height:1.65"><strong>Requirement type:</strong> ${safe(input.projectType)}</p>
    <a href="${safe(input.intakeUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:15px 22px;font-weight:700">Complete secure requirements form →</a>
    <p style="margin:26px 0 16px;font-size:13px;line-height:1.6;color:#6f6b63">This secure form is available until ${expiry}. If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${safe(input.intakeUrl)}</span></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6f6b63">If you have a question before completing the form, reply directly to this email.</p>`;
  const bodyText = `Hello ${input.recipientName},\n\nA few details will help us assess your requirement\n\nPlease use the secure requirements form to provide the scope, expected deliverables, available files and required timescale.\n\nWe will use this information to assess technical feasibility, identify any important gaps and establish the basis for delivery review and pricing.\n\nCompleting this form does not create a project or commit either party to proceed.\n\nCompany: ${input.companyName}\nRequirement type: ${input.projectType}\nForm available until: ${expiry}\n\nComplete the secure requirements form:\n${input.intakeUrl}\n\nIf you have a question before completing the form, reply directly to this email.`;
  return { ...renderEmailLayout({ preview: 'Complete the secure requirements form for your engineering requirement.', heading: subject, bodyHtml, bodyText }), subject };
}
