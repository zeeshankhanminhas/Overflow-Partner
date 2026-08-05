const titleCase = (value: string) => value
  .replaceAll('.', ' ')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const maps: Record<string, Record<string, string>> = {
  stage: {
    prospect: 'Prospect review',
    lead: 'Lead created',
    technical: 'Technical scope',
    technical_scope: 'Technical scope',
    technical_intake: 'Technical scope',
    partner: 'Partner review',
    partner_review: 'Partner review',
    partner_pricing: 'Partner response',
    partner_commercial_response: 'Partner response',
    commercial: 'Commercial review',
    commercial_review: 'Commercial review',
    quote: 'Client quote',
    client_quote: 'Client quote',
    project: 'Project delivery',
  },
  lead: {
    new: 'Technical definition required',
    technical_intake: 'Technical scope in progress',
    qualified: 'Qualified case',
    partner_review: 'Partner review in progress',
    commercial_review: 'Commercial review required',
    quoted: 'Client quote issued',
    won: 'Accepted',
    lost: 'Closed — not proceeding',
  },
  technical: {
    draft: 'Scope being prepared',
    submitted: 'Scope awaiting approval',
    under_review: 'Scope under review',
    approved: 'Technical scope approved',
    rejected: 'Scope requires correction',
  },
  partnerReview: {
    draft: 'Preparing partner request',
    invited: 'Awaiting partner response',
    opened: 'Awaiting partner response',
    in_progress: 'Partner response in progress',
    submitted: 'Partner response received',
    clarification_required: 'Clarification required',
    approved: 'Approved for commercial progression',
    approved_with_conditions: 'Approved with conditions',
    rejected: 'Partner response rejected',
    revoked: 'Partner access revoked',
    expired: 'Partner request expired',
  },
  partnerQuote: {
    requested: 'Awaiting commercial response',
    received: 'Commercial response received',
    under_review: 'Commercial response under review',
    selected: 'Commercial response selected',
    declined: 'Commercial response declined',
    expired: 'Commercial response expired',
  },
  commercialReview: {
    draft: 'Commercial position being prepared',
    pending_approval: 'Awaiting commercial approval',
    approved: 'Commercial position approved',
    rejected: 'Commercial position requires revision',
  },
  clientQuote: {
    draft: 'Client quote in preparation',
    internal_review: 'Client quote awaiting approval',
    issued: 'Client quote issued',
    accepted: 'Client quote accepted',
    declined: 'Client quote declined',
    expired: 'Client quote expired',
    superseded: 'Client quote superseded',
  },
  project: {
    planning: 'Delivery planning',
    active: 'Delivery in progress',
    waiting: 'Delivery blocked',
    review: 'Delivery under review',
    completed: 'Delivery completed',
    closed: 'Project closed',
    cancelled: 'Project cancelled',
  },
  task: {
    open: 'Action required',
    in_progress: 'In progress',
    blocked: 'Blocked',
    completed: 'Complete',
    cancelled: 'Cancelled',
  },
  decision: {
    approved: 'Approved for commercial progression',
    approved_with_conditions: 'Approved with conditions',
    clarification_required: 'Clarification required',
    rejected: 'Rejected',
  },
  feasibility: {
    feasible: 'Feasible',
    feasible_with_conditions: 'Feasible with conditions',
    more_information_required: 'More information required',
    not_feasible: 'Not feasible',
  },
  capacity: {
    available: 'Capacity available',
    limited: 'Limited capacity',
    unavailable: 'No capacity available',
  },
  pricingReadiness: {
    ready: 'Price submitted',
    pending_information: 'Pricing requires information',
    technical_review_only: 'Technical response only',
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
    partner_review_request_created: 'Partner review request created',
    partner_review_invitation_sent: 'Partner invitation sent',
    partner_review_invitation_opened: 'Partner opened review',
    partner_review_response_submitted: 'Partner response received',
    partner_review_clarification_requested: 'Clarification requested',
    partner_review_approved: 'Partner response approved',
    partner_review_rejected: 'Partner response rejected',
    partner_review_access_revoked: 'Partner access revoked',
    partner_review_token_expired: 'Partner request expired',
    partner_quote_created: 'Commercial response recorded',
    partner_quote_selected: 'Commercial response selected',
    commercial_review_created: 'Commercial review created',
    quote_issued: 'Client quote issued',
    project_created: 'Project created',
    case_created: 'Case created',
  };
  return events[value] || titleCase(value);
}

export function partnerReviewNextAction(status: string | null | undefined, hasResponse: boolean) {
  if (!status) return 'Create controlled partner review request';
  if (['draft', 'invited', 'opened', 'in_progress'].includes(status)) return 'Await partner technical and commercial response';
  if (status === 'submitted' && hasResponse) return 'Complete internal technical decision';
  if (status === 'clarification_required') return 'Await revised partner response';
  if (['approved', 'approved_with_conditions'].includes(status)) return 'Review submitted commercial position';
  if (status === 'rejected') return 'Select another execution partner';
  if (status === 'expired') return 'Issue a new partner review request';
  if (status === 'revoked') return 'Select and invite another partner';
  return 'Review partner case';
}
