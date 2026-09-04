import * as React from 'react';
import { render, toPlainText } from 'react-email';
import {
  lifecycleEmailComponents,
  type EmailFact,
  type LifecycleEmailProps,
} from '@/lib/notifications/email-components/LifecycleEmails';

type NotificationRow = {
  event_key: string;
  category: string;
  recipient_name: string | null;
  subject: string;
  template_key: string;
  payload: Record<string, unknown>;
};

type EmailFamily = keyof typeof lifecycleEmailComponents;

type Copy = { heading: string; body: string; action: string };

const lifecycleFamilies = new Set<EmailFamily>([
  'acknowledgement','nurture','secure_action','reminder','partner_review','quote','payment',
  'partner_work','action_required','delivery_review','completion','internal_alert',
]);

function text(value: unknown) {
  return String(value ?? '').trim();
}

function copy(template: string, payload: Record<string, unknown>): Copy {
  if (lifecycleFamilies.has(template as EmailFamily)) {
    return {
      heading: text(payload.heading) || 'Overflow Partner update',
      body: text(payload.message) || 'There is an update in your Overflow Partner workflow.',
      action: text(payload.actionLabel) || 'Open workspace',
    };
  }

  // Backwards-compatible copy for messages queued before the lifecycle-family migration.
  const company = text(payload.company) || 'your team';
  const reference = text(payload.reference || payload.caseReference || payload.projectReference);
  const due = text(payload.dueDate || payload.validUntil);
  const amount = text(payload.amount || payload.total || payload.balance);
  const variants: Record<string, Copy> = {
    enquiry_acknowledgement: { heading:'Thank you for your enquiry', body:`We have received your engineering requirement${company ? ` for ${company}` : ''} and will review the scope, available information and requested timescale. You will not need to resubmit information already provided.`, action:'Reply to this email' },
    technical_intake_invitation: { heading:'A few details will help us assess your requirement', body:'Please use the secure requirements form to provide the scope, expected deliverables, available files and required timescale. Completing the form does not create a project or commit either party to proceed.', action:'Complete secure requirements form' },
    technical_intake_reminder: { heading:'Your secure requirements form is still open', body:`We still need the outstanding engineering details before we can complete our assessment${due ? `. The secure form is available until ${due}` : ''}.`, action:'Continue secure requirements form' },
    partner_review_request: { heading:'Please review this engineering work package', body:`Assess the supplied package${reference ? ` for ${reference}` : ''} and submit feasibility, assumptions, exclusions, risks, lead time and your commercial quotation through the secure review. This is not an instruction to begin work.`, action:'Open secure delivery review' },
    partner_review_requested: { heading:'Please review this engineering work package', body:`Assess the supplied package${reference ? ` for ${reference}` : ''} and submit feasibility, assumptions, exclusions, risks, lead time and your commercial quotation through the secure review. This is not an instruction to begin work.`, action:'Open secure delivery review' },
    partner_review_reminder: { heading:'Your delivery review is still awaiting a response', body:`The secure review remains open${due ? ` until ${due}` : ''}. Please complete the requested feasibility, timing and commercial response, or let us know promptly if you cannot complete it.`, action:'Continue secure delivery review' },
    quote_issued: { heading:'Your quotation is ready for review', body:`Quotation${reference ? ` ${reference}` : ''} has been issued${due ? ` and remains valid until ${due}` : ''}. Review its scope, assumptions, exclusions, price and payment terms before replying in writing.`, action:'Reply about this quotation' },
    quote_reminder: { heading:'A quick follow-up on your quotation', body:`Please let us know if you need clarification on quotation${reference ? ` ${reference}` : ''}${due ? ` before its ${due} validity date` : ''}.`, action:'Reply about this quotation' },
    invoice_issued: { heading:'Your invoice is available', body:`Invoice${reference ? ` ${reference}` : ''}${amount ? ` for ${amount}` : ''} has been issued${due ? ` and is due ${due}` : ''}.`, action:'View invoice' },
    invoice_due_reminder: { heading:'Your invoice is approaching its due date', body:`Invoice${reference ? ` ${reference}` : ''}${amount ? ` has an outstanding balance of ${amount}` : ' remains outstanding'}${due ? ` with a due date of ${due}` : ''}. If payment is already in progress, no action is needed.`, action:'View invoice' },
    invoice_overdue_reminder: { heading:'Your invoice is overdue', body:`Our records show that invoice${reference ? ` ${reference}` : ''}${amount ? ` has an outstanding balance of ${amount}` : ' remains outstanding'}${due ? ` after its ${due} due date` : ''}. Please contact us if there is a query or payment has already been arranged.`, action:'View invoice' },
    payment_received: { heading:'Payment received — thank you', body:`We have recorded your payment${amount ? ` of ${amount}` : ''}${reference ? ` against invoice ${reference}` : ''}.`, action:'View updated invoice' },
    document_issued: { heading:'A controlled document has been issued', body:`The current controlled document${reference ? `, ${reference},` : ''} has been issued for review. Please use only the identified revision.`, action:'Reply about this document' },
    client_review_reminder: { heading:'Your deliverables are awaiting review', body:`The current delivery${reference ? ` ${reference}` : ''} is awaiting your written review${due ? ` by ${due}` : ''}. Reply with approval or a clear list of required changes.`, action:'Reply with your review' },
    nurture_capacity: { heading:'Additional engineering capacity, without disrupting your team', body:'When workload exceeds available capacity, Overflow Partner provides carefully scoped engineering support while your team retains ownership of the requirement and approval decisions.', action:'Reply to discuss the requirement' },
    nurture_intake: { heading:'What helps us assess an overflow requirement', body:'A useful first assessment normally includes intended deliverables, source files, discipline, timing, standards, review expectations and known constraints.', action:'Share a requirement' },
    nurture_process: { heading:'From enquiry to delivery', body:'A requirement moves through requirements capture, delivery review, commercial review, quotation, payment, project delivery, internal review and client issue.', action:'See how it works' },
    nurture_checkin: { heading:'Planning for upcoming engineering capacity', body:'If an upcoming programme may create a temporary engineering or documentation bottleneck, we can assess the requirement before the pressure becomes urgent.', action:'Start a conversation' },
    nurture_final: { heading:'A final check-in from Overflow Partner', body:'We will leave things here for now. When additional engineering capacity is useful, you can return to the enquiry or reply directly to this message.', action:'Return to your enquiry' },
    system_failure: { heading:'Overflow Partner notification requires attention', body:text(payload.message) || 'A notification could not be delivered after repeated attempts.', action:'Open workspace' },
  };
  return variants[template] || { heading:text(payload.heading) || 'Overflow Partner update', body:text(payload.message) || 'There is an update in your Overflow Partner workflow.', action:text(payload.actionLabel) || 'Open workspace' };
}

function familyFor(template: string): EmailFamily {
  if (lifecycleFamilies.has(template as EmailFamily)) return template as EmailFamily;
  if (template.startsWith('invoice_') || template === 'payment_received') return 'payment';
  if (template.includes('reminder')) return 'reminder';
  if (template.startsWith('partner_review')) return 'partner_review';
  if (template.startsWith('quote_')) return 'quote';
  if (template.startsWith('nurture_')) return 'nurture';
  if (template === 'system_failure') return 'internal_alert';
  return 'acknowledgement';
}

function contextRows(payload: Record<string, unknown>, eventKey: string): EmailFact[] {
  const rows: EmailFact[] = [];
  const add = (label: string, value: unknown) => {
    const valueText = text(value);
    if (valueText) rows.push({ label, value: valueText });
  };
  add('Company', payload.company);
  add('Project', payload.project);
  add('Requirement reference', payload.opportunityReference);
  add('Project reference', payload.projectReference);
  add('Reference', payload.reference || payload.caseReference);
  add('Revision', payload.revision);
  add('Amount', payload.amount);
  add('Outstanding balance', payload.balance);
  add('Payment reference', payload.paymentReference);
  add(['requirements.requested', 'requirements.reminder'].includes(eventKey) ? 'Form available until' : 'Due date', payload.dueDate);
  add('Valid until', payload.validUntil);
  add('Completion date', payload.completionDate);
  add('Review outcome', payload.outcome);
  return rows;
}

const directReplyEvents = new Set([
  'enquiry.received',
  'enquiry.nurture.day2',
  'enquiry.nurture.day5',
  'enquiry.nurture.day10',
  'enquiry.nurture.day18',
  'enquiry.nurture.day30',
  'partner_review.clarification',
  'quote.issued',
  'quote.followup',
  'quote.expiry',
  'quote.accepted',
  'client_delivery.issued',
  'client_delivery.review_reminder',
  'client_delivery.review_outcome',
  'project.completed',
  'partner_payment.sent',
  'dormant_opportunity.day30',
  'dormant_opportunity.day60',
  'dormant_opportunity.day90',
  'dormant_opportunity.day180',
]);

export async function renderNotificationEmail(row: NotificationRow) {
  const payload = row.payload || {};
  const content = copy(row.template_key, payload);
  const family = familyFor(row.template_key);
  const Component = lifecycleEmailComponents[family];
  const replyAddress = process.env.RESEND_REPLY_TO_EMAIL || process.env.RESEND_FROM_EMAIL;
  const actionUrl = (directReplyEvents.has(row.event_key) || content.action.startsWith('Reply')) && replyAddress
    ? `mailto:${replyAddress}?subject=${encodeURIComponent(`Re: ${row.subject}`)}`
    : text(payload.actionUrl) || process.env.NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app';
  const unsubscribeUrl = row.category === 'nurture' ? text(payload.unsubscribeUrl) : '';
  const props: LifecycleEmailProps = {
    recipient: row.recipient_name || text(payload.name) || 'there',
    heading: content.heading,
    message: content.body,
    preheader: text(payload.preheader) || content.heading,
    actionLabel: content.action,
    actionUrl,
    facts: contextRows(payload, row.event_key),
    unsubscribeUrl: unsubscribeUrl || undefined,
    note: text(payload.nextStep || payload.instruction || payload.note) || undefined,
  };

  const element = React.createElement(Component, props);
  const html = await render(element);
  const plainHtml = await render(element);
  const plainText = toPlainText(plainHtml);
  return { html, text: plainText };
}
