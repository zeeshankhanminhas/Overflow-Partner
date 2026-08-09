export const acquisitionStages = [
  'Prospect',
  'Customer intake',
  'Internal review',
  'Partner review',
  'Partner response',
  'Go / No-Go',
  'Case created',
] as const;

export type AcquisitionActionKey =
  | 'create_intake'
  | 'wait_customer'
  | 'request_partner'
  | 'wait_partner'
  | 'review_partner_response'
  | 'resolve_clarification'
  | 'create_case'
  | 'open_case'
  | 'closed';

export type AcquisitionStateInput = {
  prospectStatus?: string | null;
  hasSession: boolean;
  sessionStatus?: string | null;
  hasSubmission: boolean;
  convertedCaseId?: string | null;
  hasPartnerRequest?: boolean;
  partnerRequestStatus?: string | null;
  hasPartnerResponse?: boolean;
  partnerDecision?: string | null;
  hasPartnerPricing?: boolean;
};

export type AcquisitionState = {
  stageIndex: number;
  currentState: string;
  nextAction: string;
  nextReason: string;
  actionKey: AcquisitionActionKey;
  submitted: boolean;
  qualified: boolean;
  converted: boolean;
  waitingExternally: boolean;
  readiness: {
    prospect: 'Captured';
    technicalIntake: string;
    technicalSubmission: 'Submitted' | 'Outstanding';
    partnerReview: string;
    partnerPricing: 'Received' | 'Outstanding';
    approval: string;
    qualification: 'Pending' | 'Qualified' | 'Converted' | 'Closed';
  };
};

function labelStatus(value?: string | null) {
  return value ? value.replaceAll('_', ' ') : 'Not created';
}

export function resolveAcquisitionState(input: AcquisitionStateInput): AcquisitionState {
  const status = String(input.prospectStatus || 'new');
  const submitted = Boolean(input.hasSubmission || input.sessionStatus === 'submitted');
  const qualified = status === 'qualified';
  const converted = status === 'converted';
  const closed = ['not_a_fit','archived'].includes(status);
  const partnerStatus = String(input.partnerRequestStatus || '');
  const partnerApproved = ['approved','approved_with_conditions'].includes(String(input.partnerDecision || ''));

  let stageIndex = 0;
  let currentState = 'Prospect captured';
  let nextAction = 'Create technical intake';
  let nextReason = 'Customer technical evidence is required before the opportunity can progress.';
  let actionKey: AcquisitionActionKey = 'create_intake';
  let waitingExternally = false;

  if (input.hasSession && !submitted && !converted) {
    stageIndex = 1;
    currentState = 'Awaiting customer technical intake';
    nextAction = 'Wait for customer submission';
    nextReason = 'The secure Step 2 intake is with the customer. No internal decision is required yet.';
    actionKey = 'wait_customer';
    waitingExternally = true;
  }

  if (submitted && !input.hasPartnerRequest && !converted && !closed) {
    stageIndex = 2;
    currentState = qualified ? 'Partner gate required before Case creation' : 'Customer intake received';
    nextAction = 'Request governed partner review';
    nextReason = qualified
      ? 'This Prospect carries a legacy qualified flag, but the new lifecycle does not trust that flag. A real partner response, pricing and Go / No-Go approval are still required.'
      : 'The Step 2 evidence is complete enough to send a controlled technical and pricing request to an approved partner.';
    actionKey = 'request_partner';
  }

  if (input.hasPartnerRequest && ['draft','invited','opened','in_progress'].includes(partnerStatus) && !converted) {
    stageIndex = 3;
    currentState = partnerStatus === 'opened' || partnerStatus === 'in_progress' ? 'Partner review in progress' : 'Awaiting partner response';
    nextAction = 'Wait for partner response';
    nextReason = 'The controlled review pack is with the execution partner. Feasibility and partner pricing must come from the partner before Case 360 can exist.';
    actionKey = 'wait_partner';
    waitingExternally = true;
  }

  if (input.hasPartnerResponse && partnerStatus === 'submitted' && !input.partnerDecision && !converted) {
    stageIndex = 4;
    currentState = 'Partner response received';
    nextAction = 'Review and record Go / No-Go';
    nextReason = input.hasPartnerPricing
      ? 'Partner feasibility, delivery position and pricing are ready for your governed approval decision.'
      : 'The partner response is present but required pricing is missing. Approval must remain blocked.';
    actionKey = 'review_partner_response';
  }

  if (input.partnerDecision === 'clarification_required' && !converted) {
    stageIndex = 5;
    currentState = 'Partner clarification required';
    nextAction = 'Resolve partner clarification';
    nextReason = 'The opportunity remains in Acquisition until the requested clarification is answered and approved.';
    actionKey = 'resolve_clarification';
    waitingExternally = true;
  }

  if (partnerApproved && !converted && !closed) {
    stageIndex = 5;
    currentState = 'Approved for Case creation';
    nextAction = 'Create governed Case 360';
    nextReason = 'A real partner response, partner pricing and internal Go / No-Go approval are complete. Case 360 may now own the opportunity.';
    actionKey = 'create_case';
  }

  if (closed) {
    stageIndex = 5;
    currentState = 'Opportunity closed';
    nextAction = 'No further action';
    nextReason = 'The governed Go / No-Go decision closed this opportunity in Acquisition.';
    actionKey = 'closed';
  }

  if (converted) {
    stageIndex = 6;
    currentState = 'Converted to Case 360';
    nextAction = 'Continue in Case 360';
    nextReason = input.convertedCaseId
      ? 'Acquisition is complete. Case 360 now owns the commercial conversion workflow.'
      : 'Acquisition is complete, but the converted Case reference needs to be resolved.';
    actionKey = 'open_case';
  }

  return {
    stageIndex,
    currentState,
    nextAction,
    nextReason,
    actionKey,
    submitted,
    qualified,
    converted,
    waitingExternally,
    readiness: {
      prospect: 'Captured',
      technicalIntake: input.hasSession ? labelStatus(input.sessionStatus) : 'Not created',
      technicalSubmission: submitted ? 'Submitted' : 'Outstanding',
      partnerReview: input.hasPartnerRequest ? labelStatus(input.partnerRequestStatus) : 'Not requested',
      partnerPricing: input.hasPartnerPricing ? 'Received' : 'Outstanding',
      approval: partnerApproved ? 'Approved' : input.partnerDecision ? labelStatus(input.partnerDecision) : input.hasPartnerResponse ? 'Required' : 'Not ready',
      qualification: converted ? 'Converted' : closed ? 'Closed' : partnerApproved ? 'Qualified' : 'Pending',
    },
  };
}
