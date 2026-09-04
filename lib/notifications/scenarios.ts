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

export type ScenarioDefinition = {
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
    subject:'We have received your engineering enquiry', heading:'Thank you for your enquiry',
    body:'We have received your engineering requirement and will review the scope, available information and requested timescale. We will then contact you to confirm the most appropriate next step. You will not need to resubmit information already provided.',
    actionLabel:'Reply to this email',
  },
  'enquiry.nurture.day2': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'A practical way to extend engineering capacity', heading:'Additional engineering capacity, without disrupting your team',
    body:'When workload exceeds your team’s available capacity, Overflow Partner provides carefully scoped engineering support around your existing operation. Your team retains ownership of the requirement and approval decisions, while we coordinate the additional delivery capacity. If you would like to discuss the requirement or add further information, reply directly to this email.',
    actionLabel:'Reply to discuss the requirement',
  },
  'enquiry.nurture.day5': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'What we need to assess your engineering requirement', heading:'The information needed for a useful assessment',
    body:'To assess your requirement properly, we normally need:\n\n• The required engineering outcome and deliverables\n• Available drawings, models or other source files\n• Applicable standards, software or output formats\n• The required timescale and review expectations\n• Any known technical or operational constraints\n\nIf some information is not yet available, send what you have. We can identify any important gaps during our initial review.',
    actionLabel:'Reply with further information',
  },
  'enquiry.nurture.day10': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'How your requirement moves from enquiry to delivery', heading:'A controlled route from requirement to delivery',
    body:'First, we review and clarify your requirement. We then confirm technical feasibility, available delivery capacity, scope, price and commercial terms.\n\nWork only moves into project setup after the quotation is accepted and the agreed commercial condition—such as payment, a purchase order or approved credit—has been satisfied.\n\nDelivery then progresses through controlled review, issue and completion, with a clear owner and decision point at each stage.',
    actionLabel:'Reply to discuss your requirement',
  },
  'enquiry.nurture.day18': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'Plan engineering capacity before it becomes urgent', heading:'Earlier visibility gives you more delivery options',
    body:'If you can see CAD, CAM, drawing-production or engineering-documentation workload approaching, an early review allows us to assess the scope, required capability, available source information and timing before programme pressure builds.\n\nThis does not commit you to proceed. It gives you a clearer view of feasibility and suitable delivery capacity while there is still time to plan.',
    actionLabel:'Reply to discuss upcoming demand',
  },
  'enquiry.nurture.day30': {
    family:'nurture', category:'nurture', dynamicMode:'static', dynamicFields:[],
    subject:'We’ll leave this with you for now', heading:'Here when the requirement becomes active',
    body:'We will close this initial follow-up sequence here. If the requirement becomes active later, reply to this email and we can continue from the information you have already provided.\n\nIf the scope, files or required timescale have changed, you only need to tell us what is different.\n\nYou will not receive further emails in this initial enquiry sequence. Transactional messages relating to active work are unaffected.',
    actionLabel:'Reply when you’re ready',
  },
  'requirements.requested': {
    family:'secure_action', category:'transactional', dynamicMode:'contextual', dynamicFields:['reference','dueDate','actionUrl'],
    subject:'Please complete your engineering requirements', heading:'A few details will help us assess your requirement',
    body:'Please use the secure requirements form to provide the scope, expected deliverables, available files and required timescale.\n\nWe will use this information to assess technical feasibility, identify any important gaps and establish the basis for delivery review and pricing.\n\nCompleting this form does not create a project or commit either party to proceed.\n\nIf you have a question before completing the form, reply directly to this email.',
    actionLabel:'Complete secure requirements form',
  },
  'requirements.reminder': {
    family:'reminder', category:'reminder', dynamicMode:'contextual', dynamicFields:['reference','dueDate','actionUrl'],
    subject:'A reminder about your engineering requirements', heading:'Your secure requirements form is still open',
    body:'We have your initial enquiry, but we still need the outstanding engineering details before we can complete our assessment.\n\nPlease use the secure form to provide the scope, expected deliverables, available files and required timescale. If the requirement has changed or is no longer active, reply to this email and we will update our records.\n\nCompleting the form does not create a project or commit either party to proceed.',
    actionLabel:'Continue secure requirements form',
  },
  'partner_review.requested': {
    family:'partner_review', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','project','dueDate','actionUrl'],
    subject:'Engineering delivery review requested', heading:'Please review this engineering work package',
    body:'You have been invited to assess this engineering requirement through the secure delivery review.\n\nPlease review only the information and files provided, then confirm technical feasibility, required capability and software compatibility, assumptions, exclusions and missing information, significant technical or delivery risks, earliest available start date, expected lead time, and your commercial quotation and its validity.\n\nThis request is for assessment and pricing only. It is not an instruction to begin work. Do not contact the client directly or share the supplied information outside the people authorised to complete this review.',
    actionLabel:'Open secure delivery review',
  },
  'partner_review.reminder': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','dueDate','actionUrl'],
    subject:'Reminder: engineering delivery review outstanding', heading:'Your delivery review is still awaiting a response',
    body:'Your feasibility, timing and commercial response is still required before this engineering requirement can progress. Please complete the secure review by the stated response date.\n\nIf you cannot complete the assessment, let us know promptly so that we can update the delivery plan.',
    actionLabel:'Continue secure delivery review',
  },
  'partner_review.clarification': {
    family:'action_required', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','message','dueDate','actionUrl'],
    subject:'Clarification requested on your delivery review', heading:'One point needs clarification before we can proceed',
    body:'We have reviewed your delivery response and need the clarification shown below before the assessment can be approved. Please reply with the requested information, quoting the controlled reference. Do not begin work unless Overflow Partner issues a separate written work instruction.',
    actionLabel:'Reply with clarification',
  },
  'quote.issued': {
    family:'quote', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','validUntil','actionUrl'],
    subject:'Your Overflow Partner quotation is ready', heading:'Your quotation is ready for review',
    body:'We have completed our technical and commercial review and issued the quotation for your engineering requirement. Please review the scope, deliverables, assumptions, exclusions, price, validity period and payment terms before deciding whether to proceed.\n\nTo accept the quotation or request a revision, reply in writing and quote the quotation reference.',
    actionLabel:'Reply about this quotation',
  },
  'quote.followup': {
    family:'reminder', category:'reminder', dynamicMode:'contextual', dynamicFields:['reference','validUntil','actionUrl'],
    subject:'A quick follow-up on your quotation', heading:'Do you have everything you need to review the quotation?',
    body:'We are checking that you received the quotation and have everything needed to review it. If the scope, programme or commercial requirement has changed, reply before accepting so that we can confirm whether a revision is required.',
    actionLabel:'Reply about this quotation',
  },
  'quote.expiry': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','validUntil','actionUrl'],
    subject:'Quotation validity reminder', heading:'Your quotation is approaching its validity date',
    body:'The validity period for this quotation is approaching. Acceptance must be received before the stated expiry date. If your timing or requirement has changed, reply so that we can confirm whether the scope, delivery availability or price needs to be revised.',
    actionLabel:'Reply about this quotation',
  },
  'quote.accepted': {
    family:'acknowledgement', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','actionUrl'],
    subject:'Your quotation acceptance and payment are confirmed', heading:'Your project is ready for delivery setup',
    body:'Thank you. We have recorded your written acceptance and confirmed the agreed payment against the quotation.\n\nYour project reference is shown below and delivery setup will now begin. We will contact you through the agreed communication route if any further information is needed before work starts.',
    actionLabel:'Reply with a question',
  },
  'payment.requested': {
    family:'payment', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','dueDate','actionUrl'],
    subject:'Your Overflow Partner invoice is available', heading:'Your invoice is ready',
    body:'The invoice for this stage of work has been issued. The secure invoice view shows the amount due, payment reference, due date and current balance.\n\nWhere cleared payment is the agreed condition for starting work, delivery will only be released after that condition has been satisfied.',
    actionLabel:'View secure invoice',
  },
  'payment.due': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','amount','dueDate','actionUrl'],
    subject:'A reminder about your invoice', heading:'A payment due date is approaching',
    body:'The payment due date for this invoice is approaching and our records show an outstanding balance. If payment is already being processed, no further action is required. Otherwise, please use the secure invoice view to confirm the amount and payment reference.',
    actionLabel:'View secure invoice',
  },
  'payment.overdue': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['reference','amount','dueDate','actionUrl'],
    subject:'Invoice payment is overdue', heading:'This invoice is now overdue',
    body:'Our records show that this invoice remains outstanding after the due date. Please use the secure invoice view to confirm the current balance. If there is a query, approval delay or payment already in transit, reply so that we can keep the commercial record accurate.',
    actionLabel:'View secure invoice',
  },
  'payment.received': {
    family:'payment', category:'transactional', dynamicMode:'transactional', dynamicFields:['reference','amount','balance','actionUrl'],
    subject:'Payment received — thank you', heading:'Payment has been received',
    body:'Thank you. We have recorded your payment against the invoice and updated the outstanding balance. Where this satisfies the agreed condition for starting work, the requirement can now move into delivery setup.',
    actionLabel:'View secure invoice',
  },
  'partner_work.released': {
    family:'partner_work', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','project','dueDate','actionUrl'],
    subject:'Overflow Partner work package released', heading:'Your project work package is ready',
    body:'Overflow Partner has released the approved work package to your secure delivery workspace. Review the scope, deliverables, source files, dates, acceptance requirements and reporting expectations before confirming that work has started.\n\nWork only to the issued package and raise any conflict or missing information through Overflow Partner before proceeding.',
    actionLabel:'Open secure delivery workspace',
  },
  'partner_work.action_required': {
    family:'action_required', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','message','dueDate','actionUrl'],
    subject:'Action required on an Overflow Partner work package', heading:'A delivery action is required',
    body:'A clarification, correction or other delivery action is required on this work package. Review the current instruction and supporting context before responding. Do not change the agreed scope, price or delivery date unless Overflow Partner confirms the change in writing.',
    actionLabel:'Open secure work package',
  },
  'partner_work.delivery_received': {
    family:'acknowledgement', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','revision','actionUrl'],
    subject:'Delivery submission received', heading:'We have received your delivery submission',
    body:'Your delivery submission has been received and recorded against the work package. It is now with Overflow Partner for technical and document-control review. No further action is required unless we issue a clarification or revision request.',
    actionLabel:'Open secure delivery workspace',
  },
  'client_delivery.issued': {
    family:'delivery_review', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','reference','revision','dueDate','actionUrl'],
    subject:'Your engineering deliverables are ready for review', heading:'Your deliverables are ready for review',
    body:'We have completed our internal review and issued the current engineering delivery for your consideration. Please review the deliverables and supporting documents identified by the references below.\n\nReply in writing with your approval or a clear list of changes required, quoting the project and document references.',
    actionLabel:'Reply about this delivery',
  },
  'client_delivery.review_reminder': {
    family:'reminder', category:'reminder', dynamicMode:'transactional', dynamicFields:['projectReference','reference','dueDate','actionUrl'],
    subject:'A reminder about your engineering deliverables', heading:'Your delivery is still awaiting review',
    body:'The current engineering delivery is still awaiting your review. If the deliverables are acceptable, please reply with written approval. If changes are required, provide a clear list against the relevant document or revision reference.',
    actionLabel:'Reply with your review',
  },
  'client_delivery.review_outcome': {
    family:'delivery_review', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','outcome','comments','actionUrl'],
    subject:'Your delivery review has been recorded', heading:'Thank you — your review decision is recorded',
    body:'Thank you. We have recorded your review decision against the current delivery. If approved, the work will move toward completion. If changes were requested, they will be managed through a controlled revision before the next issue.',
    actionLabel:'Reply with a question',
  },
  'project.completed': {
    family:'completion', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','project','completionDate','reference','actionUrl'],
    subject:'Your Overflow Partner project is complete', heading:'Project complete',
    body:'The agreed engineering work has reached completion. The final issued deliverables and completion record are identified by the references below. Please retain the issued revisions as the controlled project record.\n\nThank you for trusting Overflow Partner with your additional engineering capacity.',
    actionLabel:'Reply about this project',
  },
  'partner_payment.sent': {
    family:'payment', category:'transactional', dynamicMode:'transactional', dynamicFields:['projectReference','reference','amount','paymentReference','actionUrl'],
    subject:'Payment confirmation for your work', heading:'Payment has been recorded for your work',
    body:'We have recorded payment against the approved amount for this work package. Use the project, payment and amount references below when reconciling your records. If any detail does not match your invoice or remittance information, reply to this email.',
    actionLabel:'Reply about this payment',
  },
  'dormant_opportunity.day30': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'Is this engineering requirement still likely to proceed?', heading:'A quick check on your previous requirement',
    body:'We still have the earlier requirement and discussion on record. If the timing has moved, reply with the revised programme or scope and we can reassess it without asking you to start again.',
    actionLabel:'Reply with an update',
  },
  'dormant_opportunity.day60': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'Planning around revised engineering capacity', heading:'Has the timing or scope changed?',
    body:'If the requirement remains relevant but the programme has moved, reply with the updated timing or scope. We can reassess suitable delivery capacity using the information already provided.',
    actionLabel:'Reply with revised details',
  },
  'dormant_opportunity.day90': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'We can reopen your previous engineering requirement', heading:'You do not need to start the requirement again',
    body:'If this requirement becomes active again, reply to this email and tell us what has changed—for example the scope, source files, programme dates or delivery assumptions. We can continue from the existing record.',
    actionLabel:'Reply to reopen the requirement',
  },
  'dormant_opportunity.day180': {
    family:'nurture', category:'nurture', dynamicMode:'contextual', dynamicFields:['opportunityReference','company','actionUrl'],
    subject:'A final capacity check-in from Overflow Partner', heading:'Here when another capacity requirement appears',
    body:'We will close this follow-up sequence here. If this requirement returns, or another engineering capacity need arises, reply to this email and we can begin with the context already available.',
    actionLabel:'Reply to Overflow Partner',
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
