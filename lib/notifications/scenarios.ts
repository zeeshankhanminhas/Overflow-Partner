import type { SupabaseClient } from '@supabase/supabase-js';
import { queueNotification, type NotificationCategory } from '@/lib/notifications/queue';

export type EmailFamily =
  | 'acknowledgement'
  | 'nurture'
  | 'secure_action'
  | 'reminder'
  | 'partner_review'
  | 'quote'
  | 'payment'
  | 'partner_work'
  | 'action_required'
  | 'delivery_review'
  | 'completion'
  | 'internal_alert';

export type LifecycleEmailScenario =
  | 'enquiry.received'
  | 'enquiry.nurture.day2'
  | 'enquiry.nurture.day5'
  | 'enquiry.nurture.day10'
  | 'enquiry.nurture.day18'
  | 'enquiry.nurture.day30'
  | 'requirements.requested'
  | 'requirements.reminder'
  | 'partner_review.requested'
  | 'partner_review.reminder'
  | 'partner_review.clarification'
  | 'quote.issued'
  | 'quote.followup'
  | 'quote.expiry'
  | 'quote.accepted'
  | 'payment.requested'
  | 'payment.due'
  | 'payment.overdue'
  | 'payment.received'
  | 'partner_work.released'
  | 'partner_work.action_required'
  | 'partner_work.delivery_received'
  | 'client_delivery.issued'
  | 'client_delivery.review_reminder'
  | 'client_delivery.review_outcome'
  | 'project.completed'
  | 'partner_payment.sent'
  | 'dormant_opportunity.day30'
  | 'dormant_opportunity.day60'
  | 'dormant_opportunity.day90'
  | 'dormant_opportunity.day180';

type ScenarioDefinition = {
  family: EmailFamily;
  category: NotificationCategory;
  subject: string;
  heading: string;
  body: string;
  actionLabel: string;
};

export const lifecycleEmailScenarios: Record<LifecycleEmailScenario, ScenarioDefinition> = {
  'enquiry.received': { family:'acknowledgement', category:'transactional', subject:'We have received your engineering enquiry', heading:'Thank you for contacting Overflow Partner', body:'We have received your enquiry and will review the requirement before confirming the next appropriate step.', actionLabel:'View enquiry' },
  'enquiry.nurture.day2': { family:'nurture', category:'nurture', subject:'A practical way to extend engineering capacity', heading:'A practical way to extend engineering capacity', body:'Overflow Partner provides controlled overflow support when internal engineering teams are busy, without replacing your engineering ownership or controls.', actionLabel:'Discuss a requirement' },
  'enquiry.nurture.day5': { family:'nurture', category:'nurture', subject:'What helps us assess an overflow requirement', heading:'What helps us assess an overflow requirement', body:'The fastest assessments normally include intended deliverables, source files, discipline, timescale, standards, review expectations and known constraints.', actionLabel:'Share a requirement' },
  'enquiry.nurture.day10': { family:'nurture', category:'nurture', subject:'How an overflow project moves from enquiry to delivery', heading:'From enquiry to controlled delivery', body:'A requirement moves through requirements capture, delivery review, commercial review, quotation, payment, project delivery, internal review and controlled client issue.', actionLabel:'See how it works' },
  'enquiry.nurture.day18': { family:'nurture', category:'nurture', subject:'Planning for upcoming engineering capacity', heading:'Planning for upcoming engineering capacity', body:'If an upcoming programme may create a temporary CAD, CAM or engineering-documentation bottleneck, the requirement can be assessed before the pressure becomes urgent.', actionLabel:'Start a conversation' },
  'enquiry.nurture.day30': { family:'nurture', category:'nurture', subject:'A final check-in from Overflow Partner', heading:'A final check-in from Overflow Partner', body:'We will leave things here for now. When overflow capacity is useful, you can return to the enquiry or reply directly to this message.', actionLabel:'Return to your enquiry' },
  'requirements.requested': { family:'secure_action', category:'transactional', subject:'Please complete your project requirements', heading:'A few technical details will help us assess the requirement', body:'Please complete the secure requirements form so we can understand the scope, deliverables, files and timing before progressing.', actionLabel:'Complete requirements' },
  'requirements.reminder': { family:'reminder', category:'reminder', subject:'A polite reminder about your project requirements', heading:'Your requirements form is still available', body:'We are ready to review the requirement. Please complete the secure form when convenient so the opportunity can move forward.', actionLabel:'Continue requirements' },
  'partner_review.requested': { family:'partner_review', category:'transactional', subject:'Engineering delivery review requested', heading:'A delivery review is ready', body:'Please review the technical package and submit feasibility, assumptions, risks, lead time and pricing through the secure workspace.', actionLabel:'Open delivery review' },
  'partner_review.reminder': { family:'reminder', category:'reminder', subject:'A reminder about the engineering delivery review', heading:'The delivery review is still awaiting your response', body:'Please submit the response through the secure workspace so feasibility, timing and pricing remain linked to the opportunity.', actionLabel:'Continue review' },
  'partner_review.clarification': { family:'action_required', category:'transactional', subject:'Clarification requested on your delivery review', heading:'We need one more detail before the review can progress', body:'Overflow Partner has requested clarification or a revision to the delivery review. Please open the secure workspace for the requested action.', actionLabel:'Review request' },
  'quote.issued': { family:'quote', category:'transactional', subject:'Your Overflow Partner quotation is ready', heading:'Your quotation is available', body:'Your quotation has been approved and issued for review. The secure link shows the current commercial position and validity date.', actionLabel:'Review quotation' },
  'quote.followup': { family:'reminder', category:'reminder', subject:'A polite follow-up on your quotation', heading:'A quick follow-up on your quotation', body:'We wanted to check that you have everything needed to review the quotation. If anything needs clarifying, reply to this message.', actionLabel:'Review quotation' },
  'quote.expiry': { family:'reminder', category:'reminder', subject:'Quotation validity reminder', heading:'Your quotation is approaching its validity date', body:'The current quotation is still open for review. Please contact us if timing has changed or you need the quotation revised.', actionLabel:'Review quotation' },
  'quote.accepted': { family:'acknowledgement', category:'transactional', subject:'Quotation acceptance recorded', heading:'Thank you — your quotation acceptance is recorded', body:'We have recorded your written acceptance. The next commercial step is payment confirmation before delivery begins.', actionLabel:'View opportunity' },
  'payment.requested': { family:'payment', category:'transactional', subject:'Your Overflow Partner invoice is available', heading:'Payment is required before delivery begins', body:'Your invoice has been issued. The secure invoice view shows the amount, due date and current payment status.', actionLabel:'View invoice' },
  'payment.due': { family:'reminder', category:'reminder', subject:'A polite reminder about your invoice', heading:'Your invoice is approaching its due date', body:'The invoice remains outstanding. If payment is already in progress, no action is needed.', actionLabel:'View invoice' },
  'payment.overdue': { family:'reminder', category:'reminder', subject:'Invoice payment is now overdue', heading:'Your invoice is overdue', body:'Our records show that the invoice remains outstanding after its due date. Please contact us if there is a query or payment has already been arranged.', actionLabel:'View invoice' },
  'payment.received': { family:'payment', category:'transactional', subject:'Payment received — thank you', heading:'Payment received — thank you', body:'We have recorded your payment. The project can move to its next permitted delivery step once the payment gate is satisfied.', actionLabel:'View payment status' },
  'partner_work.released': { family:'partner_work', category:'transactional', subject:'Overflow Partner work package released', heading:'A project work package is ready for you', body:'The approved scope has been released to your secure partner workspace. Review the requirements, dates and reporting expectations before confirming start.', actionLabel:'Open partner workspace' },
  'partner_work.action_required': { family:'action_required', category:'transactional', subject:'Action required on an Overflow Partner work package', heading:'Action is required on your work package', body:'A clarification, correction or delivery action is required. Open the secure partner workspace for the current instruction and supporting context.', actionLabel:'Open work package' },
  'partner_work.delivery_received': { family:'acknowledgement', category:'transactional', subject:'Delivery submission received', heading:'We received your delivery submission', body:'Your delivery submission has been recorded and is awaiting Overflow Partner review. We will contact you if clarification or revisions are required.', actionLabel:'Open partner workspace' },
  'client_delivery.issued': { family:'delivery_review', category:'transactional', subject:'Your engineering deliverables are ready for review', heading:'Your deliverables are ready for review', body:'The current controlled delivery has been issued for your review. Please use the secure link to review the deliverables and supporting documents.', actionLabel:'Review deliverables' },
  'client_delivery.review_reminder': { family:'reminder', category:'reminder', subject:'A reminder about your engineering deliverables', heading:'Your deliverables are awaiting review', body:'The controlled delivery remains open for your review. Please record approval or requested changes when convenient.', actionLabel:'Review deliverables' },
  'client_delivery.review_outcome': { family:'delivery_review', category:'transactional', subject:'Your delivery review outcome has been recorded', heading:'Your delivery review has been recorded', body:'Thank you. Your review decision has been recorded and the project has moved to the appropriate next delivery step.', actionLabel:'View project' },
  'project.completed': { family:'completion', category:'transactional', subject:'Your Overflow Partner project is complete', heading:'Project complete', body:'The project has reached completion. The final controlled deliverables and completion records remain available through the project communication route.', actionLabel:'View project' },
  'partner_payment.sent': { family:'payment', category:'transactional', subject:'Partner payment recorded', heading:'Payment has been recorded for your work', body:'Overflow Partner has recorded payment against the approved partner payable for this project.', actionLabel:'View payment reference' },
  'dormant_opportunity.day30': { family:'nurture', category:'nurture', subject:'Is this engineering requirement still likely to proceed?', heading:'A quick check on your previous requirement', body:'We still have the opportunity context available. If timing has shifted, we can pick up from the existing requirements rather than starting again.', actionLabel:'Revisit opportunity' },
  'dormant_opportunity.day60': { family:'nurture', category:'nurture', subject:'Planning around revised engineering capacity', heading:'If your programme timing has changed, we can reassess capacity', body:'If workload timing or scope has changed, Overflow Partner can reassess delivery capacity against the revised programme using the existing opportunity context.', actionLabel:'Reassess requirement' },
  'dormant_opportunity.day90': { family:'nurture', category:'nurture', subject:'We can reopen your previous engineering requirement', heading:'Reopen the requirement without starting again', body:'Your previous opportunity can be reopened using the requirements already captured. Only changed scope, files or timing need to be updated.', actionLabel:'Reopen opportunity' },
  'dormant_opportunity.day180': { family:'nurture', category:'nurture', subject:'A final capacity check-in from Overflow Partner', heading:'Here when another capacity requirement appears', body:'We will close the re-engagement cycle here. If another engineering capacity requirement arises, you can return to the previous opportunity or start a new one.', actionLabel:'Contact Overflow Partner' },
};

export async function queueLifecycleEmail(supabase: SupabaseClient, input: {
  organisationId: string;
  scenario: LifecycleEmailScenario;
  recipientEmail: string;
  recipientName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string;
  payload?: Record<string, unknown>;
  scheduledFor?: string;
  idempotencyKey?: string;
  subject?: string;
}) {
  const definition = lifecycleEmailScenarios[input.scenario];
  return queueNotification(supabase, {
    organisationId: input.organisationId,
    eventKey: input.scenario,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    subject: input.subject || definition.subject,
    templateKey: definition.family,
    payload: {
      heading: definition.heading,
      message: definition.body,
      actionLabel: definition.actionLabel,
      actionUrl: input.actionUrl,
      scenario: input.scenario,
      ...input.payload,
    },
    entityType: input.entityType,
    entityId: input.entityId,
    category: definition.category,
    scheduledFor: input.scheduledFor,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function queueInternalLifecycleAlert(supabase: SupabaseClient, input: {
  organisationId: string;
  eventKey: string;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  heading: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  return queueNotification(supabase, {
    organisationId: input.organisationId,
    eventKey: input.eventKey,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    subject: input.subject,
    templateKey: 'internal_alert',
    payload: { heading: input.heading, message: input.message, actionUrl: input.actionUrl, actionLabel: input.actionLabel || 'Open workspace', ...input.payload },
    entityType: input.entityType,
    entityId: input.entityId,
    category: 'transactional',
    idempotencyKey: input.idempotencyKey,
  });
}
