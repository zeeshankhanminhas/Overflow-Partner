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

export type EmailDynamicMode = 'static' | 'contextual' | 'transactional';

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
  dynamicMode: EmailDynamicMode;
  dynamicFields: string[];
};

export const lifecycleEmailScenarios: Record<LifecycleEmailScenario, ScenarioDefinition> = {
  'enquiry.received': {
    family:'acknowledgement', category:'transactional', dynamicMode:'contextual', dynamicFields:['company','reference'],
    subject:'We have received your engineering enquiry', heading:'Thank you for getting in touch',
    body:'Your enquiry is with our team. We will review the requirement and come back with the most useful next step rather than asking you to repeat information unnecessarily.',
    actionLabel:'View enquiry',
  },
  'enquiry.nurture.day2': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'A practical way to extend engineering capacity', heading:'Extra engineering capacity, without disrupting your team',
    body:'Overflow Partner supports engineering teams when workload temporarily exceeds internal capacity. Your team keeps technical ownership; we add clearly scoped delivery capacity around it.',
    actionLabel:'Discuss a requirement',
  },
  'enquiry.nurture.day5': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'What helps us assess an overflow requirement', heading:'The information that makes an assessment useful',
    body:'A useful first assessment is usually straightforward: what needs to be delivered, the source files available, relevant standards, required timescale, review expectations and any known constraints.',
    actionLabel:'Share a requirement',
  },
  'enquiry.nurture.day10': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'How an Overflow Partner project moves from enquiry to delivery', heading:'A clear route from requirement to delivery',
    body:'We qualify the requirement first, confirm delivery feasibility and cost, agree the client quotation and payment, then manage the work through delivery, review and completion. Each hand-off has a clear owner and decision point.',
    actionLabel:'See how it works',
  },
  'enquiry.nurture.day18': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'Planning for upcoming engineering capacity', heading:'Capacity is easier to solve before it becomes urgent',
    body:'If you can see a CAD, CAM or engineering-documentation bottleneck approaching, we can assess the requirement early and confirm whether suitable delivery capacity is available before programme pressure builds.',
    actionLabel:'Start a conversation',
  },
  'enquiry.nurture.day30': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'A final check-in from Overflow Partner', heading:'We will leave this with you',
    body:'We will close this initial follow-up here. If the requirement becomes active later, you can return to the existing enquiry or reply to this email and we can pick it up from there.',
    actionLabel:'Return to your enquiry',
  },
  'requirements.requested': {
    family:'secure_action', category:'transactional', dynamicMode:'contextual', dynamicFields:['reference','dueDate','actionUrl'],
    subject:'Please complete your project requirements', heading:'We need a few project details to assess delivery',
    body:'Please complete the secure requirements form with the scope, expected deliverables, available files and timing. We will use that information as the working basis for delivery review and pricing.',
    actionLabel:'Complete requirements',
  },
  'requirements.reminder': {
    family:'reminder', category:'reminder', dynamicMode:'contextual', dynamicFields:['reference','dueDate','actionUrl'],
    subject:'A reminder about your project requirements', heading:'Your requirements form is still open',
    body:'We are ready to assess the requirement once the outstanding project details are in place. If the requirement has changed or is no longer active, reply and we will update the opportunity accordingly.',
    actionLabel:'Continue requirements',
  },
  'partner_review.requested': {
    family:'partner_review', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','project','dueDate','actionUrl'],
    subject:'Engineering delivery review requested', heading:'Please review this engineering work package',
    body:'Please assess whether the work can be delivered as scoped and provide your assumptions, risks, lead time and commercial price through the secure review workspace. Your response will form the delivery basis for our client quotation.',
    actionLabel:'Open delivery review',
  },
  'partner_review.reminder': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','dueDate','actionUrl'],
    subject:'Reminder: engineering delivery review outstanding', heading:'Your delivery review is still awaiting a response',
    body:'We are waiting for your feasibility, timing and commercial response before this opportunity can progress. If anything prevents you from completing the review, please let us know rather than leaving the request open.',
    actionLabel:'Continue review',
  },
  'partner_review.clarification': {
    family:'action_required', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','message','dueDate','actionUrl'],
    subject:'Clarification requested on your delivery review', heading:'One point needs clarification before we can proceed',
    body:'We have reviewed your response and need an additional detail or revision before the delivery position can be approved. The specific request is available in the secure review workspace.',
    actionLabel:'Review request',
  },
  'quote.issued': {
    family:'quote', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','validUntil','actionUrl'],
    subject:'Your Overflow Partner quotation is ready', heading:'Your quotation is ready for review',
    body:'We have completed the delivery and commercial review for your requirement. The quotation sets out the agreed scope, price, assumptions and validity period for your review.',
    actionLabel:'Review quotation',
  },
  'quote.followup': {
    family:'reminder', category:'reminder', dynamicMode:'contextual', dynamicFields:['reference','validUntil','actionUrl'],
    subject:'A quick follow-up on your quotation', heading:'Do you have everything you need to review the quotation?',
    body:'We are checking that the quotation reached you and that the scope or commercial position does not need clarification. If your programme or requirement has changed, reply and we can review it before you decide.',
    actionLabel:'Review quotation',
  },
  'quote.expiry': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','validUntil','actionUrl'],
    subject:'Quotation validity reminder', heading:'Your quotation is approaching its validity date',
    body:'The current quotation remains available for acceptance, but its validity period is approaching. If your timing has moved, we can review the position and confirm whether the scope, partner availability or price needs updating.',
    actionLabel:'Review quotation',
  },
  'quote.accepted': {
    family:'acknowledgement', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','actionUrl'],
    subject:'Quotation acceptance recorded', heading:'Thank you — we have recorded your acceptance',
    body:'Your written acceptance has been recorded against the quotation. The next step is payment confirmation; delivery will not begin until the required payment condition has been satisfied.',
    actionLabel:'View opportunity',
  },
  'payment.requested': {
    family:'payment', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','dueDate','actionUrl'],
    subject:'Your Overflow Partner invoice is available', heading:'Your invoice is ready',
    body:'The invoice for this stage of work has been issued. The secure invoice view shows the amount due, payment date and current balance. Where payment is a project-start condition, work will be released once that condition is satisfied.',
    actionLabel:'View invoice',
  },
  'payment.due': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','amount','dueDate','actionUrl'],
    subject:'A reminder about your invoice', heading:'A payment due date is approaching',
    body:'Our records show an outstanding balance on this invoice. If payment is already being processed, no action is needed; otherwise the secure invoice view has the current amount and reference.',
    actionLabel:'View invoice',
  },
  'payment.overdue': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','amount','dueDate','actionUrl'],
    subject:'Invoice payment is overdue', heading:'This invoice is now overdue',
    body:'Our records show that payment remains outstanding after the due date. If there is a query, approval delay or payment already in transit, please reply so we can keep the commercial record accurate.',
    actionLabel:'View invoice',
  },
  'payment.received': {
    family:'payment', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','balance','actionUrl'],
    subject:'Payment received — thank you', heading:'Payment has been received',
    body:'We have recorded your payment against the invoice. The payment position has been updated and, where this clears the project-start condition, the work can now move into delivery setup.',
    actionLabel:'View payment status',
  },
  'partner_work.released': {
    family:'partner_work', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','project','dueDate','actionUrl'],
    subject:'Overflow Partner work package released', heading:'Your project work package is ready',
    body:'The approved scope has been released to your secure partner workspace. Please review the requirements, dates, files and reporting expectations before confirming that work has started.',
    actionLabel:'Open partner workspace',
  },
  'partner_work.action_required': {
    family:'action_required', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','message','dueDate','actionUrl'],
    subject:'Action required on an Overflow Partner work package', heading:'A delivery action is required',
    body:'A clarification, correction or other delivery action is required on this work package. The secure workspace contains the current instruction and the context needed to respond.',
    actionLabel:'Open work package',
  },
  'partner_work.delivery_received': {
    family:'acknowledgement', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','revision','actionUrl'],
    subject:'Delivery submission received', heading:'We have received your delivery submission',
    body:'Your submission has been recorded and is now with Overflow Partner for review. No further action is required unless we return with a clarification or revision request.',
    actionLabel:'Open partner workspace',
  },
  'client_delivery.issued': {
    family:'delivery_review', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','reference','revision','dueDate','actionUrl'],
    subject:'Your engineering deliverables are ready for review', heading:'Your deliverables are ready for review',
    body:'We have completed our review and issued the current delivery for your consideration. Please use the secure link to review the deliverables and supporting documents and record either approval or any changes required.',
    actionLabel:'Review deliverables',
  },
  'client_delivery.review_reminder': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['projectReference','reference','dueDate','actionUrl'],
    subject:'A reminder about your engineering deliverables', heading:'Your delivery is still awaiting review',
    body:'The current delivery remains open for your review. If you are happy with the work, please record approval; if changes are needed, add them through the review route so they can be returned to delivery with a clear record.',
    actionLabel:'Review deliverables',
  },
  'client_delivery.review_outcome': {
    family:'delivery_review', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','outcome','comments','actionUrl'],
    subject:'Your delivery review has been recorded', heading:'Thank you — your review decision is recorded',
    body:'We have recorded your review decision against the current delivery. The project will now follow the appropriate next step, whether that is completion or a controlled revision cycle.',
    actionLabel:'View project',
  },
  'project.completed': {
    family:'completion', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','project','completionDate','reference','actionUrl'],
    subject:'Your Overflow Partner project is complete', heading:'Project complete',
    body:'The agreed work has reached completion. The final delivery and project record remain available through the existing project communication route. Thank you for trusting Overflow Partner with the additional engineering capacity.',
    actionLabel:'View project',
  },
  'partner_payment.sent': {
    family:'payment', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','reference','amount','paymentReference','actionUrl'],
    subject:'Partner payment recorded', heading:'Payment has been recorded for your work',
    body:'We have recorded payment against the approved partner payable for this project. The payment reference and project context are included below for reconciliation.',
    actionLabel:'View payment reference',
  },
  'dormant_opportunity.day30': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'Is this engineering requirement still likely to proceed?', heading:'A quick check on your previous requirement',
    body:'We still have the requirement and previous discussion on record. If the timing has moved, we can keep the opportunity open and pick it up from the existing information rather than asking you to start again.',
    actionLabel:'Revisit opportunity',
  },
  'dormant_opportunity.day60': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'Planning around revised engineering capacity', heading:'Has the timing or scope changed?',
    body:'If the requirement is still relevant but your programme has moved, we can reassess delivery capacity against the revised timing and scope. The earlier opportunity context remains available to work from.',
    actionLabel:'Reassess requirement',
  },
  'dormant_opportunity.day90': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'We can reopen your previous engineering requirement', heading:'You do not need to start the requirement again',
    body:'If this work becomes active again, we can reopen the existing opportunity and only update what has changed — for example scope, files, programme dates or delivery assumptions.',
    actionLabel:'Reopen opportunity',
  },
  'dormant_opportunity.day180': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'A final capacity check-in from Overflow Partner', heading:'Here when another capacity requirement appears',
    body:'We will close this re-engagement sequence here. If this requirement returns, or another engineering capacity issue appears, reply to this email and we can pick up from the existing context.',
    actionLabel:'Contact Overflow Partner',
  },
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
      dynamicMode: definition.dynamicMode,
      dynamicFields: definition.dynamicFields,
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
    payload: { heading: input.heading, message: input.message, actionUrl: input.actionUrl, actionLabel: input.actionLabel || 'Open workspace', dynamicMode:'transactional', ...input.payload },
    entityType: input.entityType,
    entityId: input.entityId,
    category: 'transactional',
    idempotencyKey: input.idempotencyKey,
  });
}
