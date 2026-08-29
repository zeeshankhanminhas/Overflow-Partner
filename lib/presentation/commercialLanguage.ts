// Canonical human-facing language for Overflow Partner.
// Database/domain values may stay technical; normal UI must pass through this layer.

const labels: Record<string,string> = {
  invited: 'Waiting for partner',
  opened: 'Partner reviewing',
  in_progress: 'In progress',
  submitted: 'Response received',
  approved: 'Approved',
  approved_with_conditions: 'Approved with conditions',
  clarification_required: 'Clarification required',
  rejected: 'Declined',
  ready_for_execution: 'Ready to start',
  partner_correction: 'Changes needed',
  internal_review: 'Overflow Partner review',
  ready_for_client_issue: 'Ready to send to client',
  issued_to_client: 'Sent to client',
  client_review: 'Client review',
  completion: 'Complete',
  closed: 'Complete',
  on_track: 'On track',
  at_risk: 'At risk',
  blocked: 'Blocked',
  delivery_submitted: 'Work submitted',
  mobilisation: 'Preparing project',
};

export function commercialStatus(value?: unknown, fallback = 'Not recorded') {
  const key = String(value ?? '').trim();
  if (!key) return fallback;
  return labels[key] || fallback;
}

export function commercialCopy(value?: unknown) {
  return String(value ?? '')
    .replaceAll('Case 360', 'Opportunity')
    .replaceAll('case 360', 'opportunity')
    .replaceAll('Execution Partner', 'Delivery Partner')
    .replaceAll('execution partner', 'delivery partner')
    .replaceAll('Partner execution', 'Partner work')
    .replaceAll('partner execution', 'partner work')
    .replaceAll('execution exception', 'delivery issue')
    .replaceAll('Execution exception', 'Delivery issue')
    .replaceAll('exception', 'issue')
    .replaceAll('Exception', 'Issue')
    .replaceAll('commencement', 'start')
    .replaceAll('Commencement', 'Start')
    .replaceAll('governed response', 'completed response')
    .replaceAll('Governed response', 'Completed response')
    .replaceAll('lifecycle action', 'next step')
    .replaceAll('Lifecycle action', 'Next step')
    .replaceAll('Delivery Control', 'Delivery')
    .replaceAll('controlled execution package', 'approved work package')
    .replaceAll('controlled scope', 'agreed scope')
    .replaceAll('Controlled scope', 'Agreed scope');
}

export const surfaceTerms = {
  opportunity: 'Opportunity',
  opportunityOverview: 'Opportunity Overview',
  projectOverview: 'Project Overview',
  deliveryPartner: 'Delivery Partner',
  requirements: 'Requirements',
  deliveryReview: 'Delivery Review',
  commercialReview: 'Commercial Review',
  clientQuote: 'Client Quote',
  activity: 'Activity',
  issue: 'Issue',
} as const;
