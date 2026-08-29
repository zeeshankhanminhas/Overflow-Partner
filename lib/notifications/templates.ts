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
    enquiry_acknowledgement: { heading:'Thank you for contacting Overflow Partner', body:`We have received your enquiry${company ? ` for ${company}` : ''}. We will review the requirement and confirm the next appropriate step.`, action:'View enquiry' },
    technical_intake_invitation: { heading:'A few technical details will help us assess the requirement', body:'Please complete the secure technical intake so we can understand the scope, deliverables, files and timing before progressing.', action:'Complete technical intake' },
    technical_intake_reminder: { heading:'A reminder about your technical intake', body:`We are ready to review the requirement${reference ? ` under ${reference}` : ''}. The secure intake remains available${due ? ` and is due ${due}` : ''}.`, action:'Continue technical intake' },
    partner_review_request: { heading:'An engineering delivery review is ready', body:`Please review the technical package${reference ? ` for ${reference}` : ''} and submit feasibility, assumptions, risks, lead time and pricing through the secure workspace.`, action:'Open delivery review' },
    partner_review_requested: { heading:'An engineering delivery review is ready', body:`Please review the technical package${reference ? ` for ${reference}` : ''} and submit feasibility, assumptions, risks, lead time and pricing through the secure workspace.`, action:'Open delivery review' },
    partner_review_reminder: { heading:'The delivery review is awaiting your response', body:`The review remains open${due ? ` and is due ${due}` : ''}. Please submit the response through the secure workspace so it remains linked to the opportunity.`, action:'Continue review' },
    quote_issued: { heading:'Your quotation is ready', body:`Quotation${reference ? ` ${reference}` : ''} has been issued for your review${due ? ` and remains valid until ${due}` : ''}.`, action:'Review quotation' },
    quote_reminder: { heading:'A quick follow-up on your quotation', body:`We wanted to check that you have everything needed to review quotation${reference ? ` ${reference}` : ''}${due ? `. Its current validity date is ${due}` : ''}.`, action:'Review quotation' },
    invoice_issued: { heading:'Your invoice is available', body:`Invoice${reference ? ` ${reference}` : ''}${amount ? ` for ${amount}` : ''} has been issued${due ? ` and is due ${due}` : ''}.`, action:'View invoice' },
    invoice_due_reminder: { heading:'Your invoice is approaching its due date', body:`Invoice${reference ? ` ${reference}` : ''}${amount ? ` has an outstanding balance of ${amount}` : ' remains outstanding'}${due ? ` with a due date of ${due}` : ''}. If payment is already in progress, no action is needed.`, action:'View invoice' },
    invoice_overdue_reminder: { heading:'Your invoice is overdue', body:`Our records show that invoice${reference ? ` ${reference}` : ''}${amount ? ` has an outstanding balance of ${amount}` : ' remains outstanding'}${due ? ` after its ${due} due date` : ''}. Please contact us if there is a query or payment has already been arranged.`, action:'View invoice' },
    payment_received: { heading:'Payment received — thank you', body:`We have recorded your payment${amount ? ` of ${amount}` : ''}${reference ? ` against invoice ${reference}` : ''}.`, action:'View updated invoice' },
    document_issued: { heading:'A document has been issued', body:`A current project document${reference ? `, ${reference},` : ''} is available for review and download.`, action:'Open document' },
    client_review_reminder: { heading:'Your deliverables are awaiting review', body:`The current delivery${reference ? ` ${reference}` : ''} is awaiting your review${due ? ` by ${due}` : ''}.`, action:'Review deliverables' },
    nurture_capacity: { heading:'A practical way to extend engineering capacity', body:'Overflow Partner provides additional engineering capacity when internal teams are busy, while your team keeps ownership of the requirement and approval process.', action:'Discuss a requirement' },
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

function contextRows(payload: Record<string, unknown>): EmailFact[] {
  const rows: EmailFact[] = [];
  const add = (label: string, value: unknown) => {
    const valueText = text(value);
    if (valueText) rows.push({ label, value: valueText });
  };
  add('Company', payload.company);
  add('Project', payload.project);
  add('Opportunity', payload.opportunityReference);
  add('Project reference', payload.projectReference);
  add('Reference', payload.reference || payload.caseReference);
  add('Revision', payload.revision);
  add('Amount', payload.amount);
  add('Outstanding balance', payload.balance);
  add('Payment reference', payload.paymentReference);
  add('Due date', payload.dueDate);
  add('Valid until', payload.validUntil);
  add('Completion date', payload.completionDate);
  add('Review outcome', payload.outcome);
  return rows;
}

export async function renderNotificationEmail(row: NotificationRow) {
  const payload = row.payload || {};
  const content = copy(row.template_key, payload);
  const family = familyFor(row.template_key);
  const Component = lifecycleEmailComponents[family];
  const actionUrl = text(payload.actionUrl) || process.env.NEXT_PUBLIC_APP_URL || 'https://overflow-partner.vercel.app';
  const unsubscribeUrl = row.category === 'nurture' ? text(payload.unsubscribeUrl) : '';
  const props: LifecycleEmailProps = {
    recipient: row.recipient_name || text(payload.name) || 'there',
    heading: content.heading,
    message: content.body,
    preheader: text(payload.preheader) || content.heading,
    actionLabel: content.action,
    actionUrl,
    facts: contextRows(payload),
    unsubscribeUrl: unsubscribeUrl || undefined,
    note: text(payload.nextStep || payload.instruction || payload.note) || undefined,
  };

  const element = React.createElement(Component, props);
  const html = await render(element);
  const plainHtml = await render(element);
  const plainText = toPlainText(plainHtml);
  return { html, text: plainText };
}
