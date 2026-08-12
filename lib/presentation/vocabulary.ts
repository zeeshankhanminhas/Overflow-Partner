const titleCase = (value: string) => value
  .replaceAll('.', ' ')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const maps: Record<string, Record<string, string>> = {
  stage: {
    prospect: 'New enquiry',
    lead: 'Case created',
    technical: 'Technical scope',
    technical_scope: 'Technical scope',
    technical_intake: 'Technical scope',
    partner: 'Partner assessment',
    partner_review: 'Partner assessment',
    partner_pricing: 'Partner price',
    partner_commercial_response: 'Partner price',
    commercial: 'Commercial position',
    commercial_review: 'Commercial review',
    quote: 'Client quote',
    client_quote: 'Client quote',
    project: 'Project delivery',
  },
  lead: {
    new: 'Scope required',
    technical_intake: 'Scope in progress',
    qualified: 'Ready for Case review',
    partner_review: 'Partner assessment in progress',
    commercial_review: 'Commercial review needed',
    quoted: 'Quote sent',
    won: 'Accepted',
    lost: 'Closed — not proceeding',
  },
  technical: {
    draft: 'Scope being prepared',
    submitted: 'Approval needed',
    under_review: 'Scope under review',
    approved: 'Scope approved',
    rejected: 'Changes needed',
  },
  technicalIntake: {
    draft: 'Being prepared',
    submitted: 'Ready for approval',
    under_review: 'Under review',
    approved: 'Approved',
    rejected: 'Changes needed',
  },
  partnerReview: {
    draft: 'Assessment being prepared',
    invited: 'Waiting for Partner',
    opened: 'Partner is reviewing',
    in_progress: 'Partner is reviewing',
    submitted: 'Assessment received',
    clarification_required: 'More information needed',
    approved: 'Approved',
    approved_with_conditions: 'Approved with conditions',
    rejected: 'Not approved',
    revoked: 'Partner access revoked',
    expired: 'Assessment request expired',
  },
  partnerQuote: {
    requested: 'Waiting for Partner price',
    received: 'Partner price received',
    under_review: 'Partner price under review',
    selected: 'Partner price selected',
    declined: 'Partner price declined',
    expired: 'Partner price expired',
  },
  commercialReview: {
    draft: 'Commercial position being prepared',
    pending_approval: 'Approval needed',
    approved: 'Commercial position approved',
    rejected: 'Commercial position needs revision',
  },
  clientQuote: {
    draft: 'Quote being prepared',
    internal_review: 'Quote approval needed',
    issued: 'Quote sent',
    accepted: 'Quote accepted',
    declined: 'Quote declined',
    expired: 'Quote expired',
    superseded: 'Quote replaced',
  },
  document: {
    draft: 'Draft',
    review: 'In review',
    changes_requested: 'Changes needed',
    signed: 'Signed',
    approved: 'Approved',
    issued: 'Issued',
    archived: 'Archived',
    superseded: 'Replaced',
  },
  project: {
    planning: 'Mobilising',
    active: 'In progress',
    waiting: 'Waiting',
    review: 'Under review',
    completed: 'Delivery complete',
    closed: 'Closed',
    cancelled: 'Cancelled',
  },
  task: {
    open: 'Action needed',
    in_progress: 'In progress',
    blocked: 'Blocked',
    completed: 'Complete',
    cancelled: 'Cancelled',
  },
  decision: {
    approved: 'Go',
    approved_with_conditions: 'Go with conditions',
    clarification_required: 'More information needed',
    rejected: 'No-Go',
  },
  feasibility: {
    feasible: 'Feasible',
    feasible_with_conditions: 'Feasible with conditions',
    more_information_required: 'More information needed',
    not_feasible: 'Not feasible',
  },
  capacity: {
    available: 'Capacity available',
    limited: 'Limited capacity',
    unavailable: 'No capacity available',
  },
  pricingReadiness: {
    ready: 'Price submitted',
    pending_information: 'More information needed',
    technical_review_only: 'Assessment only',
  },
};

export type VocabularyDomain = keyof typeof maps;

export function workspaceLabel(value: string | null | undefined, domain?: VocabularyDomain) {
  if (!value) return 'Not recorded';
  return (domain && maps[domain]?.[value]) || titleCase(value);
}

export function eventLabel(value: string | null | undefined) {
  if (!value) return 'Activity recorded';
  const events: Record<string, string> = {
    technical_intake_submitted: 'Customer scope received',
    prospect_qualified: 'Approved to create Case',
    partner_review_request_created: 'Partner assessment created',
    partner_review_invitation_sent: 'Partner assessment sent',
    partner_review_invitation_opened: 'Partner opened assessment',
    partner_review_response_submitted: 'Partner assessment received',
    partner_review_clarification_requested: 'More information requested',
    partner_review_approved: 'Partner assessment approved',
    partner_review_rejected: 'Partner assessment not approved',
    partner_review_access_revoked: 'Partner access revoked',
    partner_review_token_expired: 'Partner assessment expired',
    partner_quote_created: 'Partner price recorded',
    partner_quote_selected: 'Partner price selected',
    commercial_review_created: 'Commercial review created',
    quote_issued: 'Client quote sent',
    project_created: 'Project created',
    case_created: 'Case created',
  };
  return events[value] || titleCase(value);
}

export function partnerReviewNextAction(status: string | null | undefined, hasResponse: boolean) {
  if (!status) return 'Create Partner assessment';
  if (['draft', 'invited', 'opened', 'in_progress'].includes(status)) return 'Wait for Partner';
  if (status === 'submitted' && hasResponse) return 'Record Go / No-Go';
  if (status === 'clarification_required') return 'Wait for revised assessment';
  if (['approved', 'approved_with_conditions'].includes(status)) return 'Review Partner price';
  if (status === 'rejected') return 'Choose another Partner';
  if (status === 'expired') return 'Send a new assessment';
  if (status === 'revoked') return 'Choose another Partner';
  return 'Review Partner assessment';
}
