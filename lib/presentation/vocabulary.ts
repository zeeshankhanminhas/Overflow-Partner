const titleCase = (value: string) => value
  .replaceAll('.', ' ')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const maps: Record<string, Record<string, string>> = {
  stage: {
    prospect: 'Prospect review',
    lead: 'Case created',
    technical: 'Technical scope',
    technical_scope: 'Technical scope',
    technical_intake: 'Technical scope',
    partner: 'Partner review',
    partner_review: 'Partner review',
    partner_pricing: 'Partner response',
    partner_commercial_response: 'Partner response',
    commercial: 'Pricing',
    commercial_review: 'Pricing review',
    quote: 'Client quote',
    client_quote: 'Client quote',
    project: 'Project delivery',
  },
  lead: {
    new: 'Scope required',
    technical_intake: 'Scope in progress',
    qualified: 'Ready for review',
    partner_review: 'Partner review in progress',
    commercial_review: 'Pricing review needed',
    quoted: 'Client quote issued',
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
  partnerReview: {
    draft: 'Preparing partner request',
    invited: 'Waiting for partner',
    opened: 'Waiting for partner',
    in_progress: 'Partner response in progress',
    submitted: 'Partner response received',
    clarification_required: 'More information needed',
    approved: 'Approved',
    approved_with_conditions: 'Approved with conditions',
    rejected: 'Partner response rejected',
    revoked: 'Partner access revoked',
    expired: 'Partner request expired',
  },
  partnerQuote: {
    requested: 'Waiting for partner price',
    received: 'Partner price received',
    under_review: 'Partner price under review',
    selected: 'Partner price selected',
    declined: 'Partner price declined',
    expired: 'Partner price expired',
  },
  commercialReview: {
    draft: 'Pricing being prepared',
    pending_approval: 'Approval needed',
    approved: 'Pricing approved',
    rejected: 'Pricing needs revision',
  },
  clientQuote: {
    draft: 'Quote in preparation',
    internal_review: 'Quote approval needed',
    issued: 'Quote issued',
    accepted: 'Quote accepted',
    declined: 'Quote declined',
    expired: 'Quote expired',
    superseded: 'Quote superseded',
  },
  project: {
    planning: 'Planning',
    active: 'In progress',
    waiting: 'Blocked',
    review: 'Under review',
    completed: 'Complete',
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
    approved: 'Approved',
    approved_with_conditions: 'Approved with conditions',
    clarification_required: 'More information needed',
    rejected: 'Rejected',
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
    technical_review_only: 'Technical review only',
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
    technical_intake_submitted: 'Customer technical intake received',
    prospect_qualified: 'Prospect qualified',
    partner_review_request_created: 'Partner review created',
    partner_review_invitation_sent: 'Partner invitation sent',
    partner_review_invitation_opened: 'Partner opened review',
    partner_review_response_submitted: 'Partner response received',
    partner_review_clarification_requested: 'More information requested',
    partner_review_approved: 'Partner response approved',
    partner_review_rejected: 'Partner response rejected',
    partner_review_access_revoked: 'Partner access revoked',
    partner_review_token_expired: 'Partner request expired',
    partner_quote_created: 'Partner price recorded',
    partner_quote_selected: 'Partner price selected',
    commercial_review_created: 'Pricing review created',
    quote_issued: 'Client quote issued',
    project_created: 'Project created',
    case_created: 'Case created',
  };
  return events[value] || titleCase(value);
}

export function partnerReviewNextAction(status: string | null | undefined, hasResponse: boolean) {
  if (!status) return 'Create partner review';
  if (['draft', 'invited', 'opened', 'in_progress'].includes(status)) return 'Wait for partner response';
  if (status === 'submitted' && hasResponse) return 'Record internal decision';
  if (status === 'clarification_required') return 'Wait for revised partner response';
  if (['approved', 'approved_with_conditions'].includes(status)) return 'Review partner price';
  if (status === 'rejected') return 'Select another partner';
  if (status === 'expired') return 'Send a new partner review';
  if (status === 'revoked') return 'Select another partner';
  return 'Review partner response';
}
