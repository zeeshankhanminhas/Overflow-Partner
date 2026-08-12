export const acquisitionStages = [
  'Enquiry',
  'Customer scope',
  'Internal check',
  'Partner assessment',
  'Partner decision',
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
  let currentState = 'New enquiry';
  let nextAction = 'Send technical intake';
  let nextReason = 'We need the customer’s technical scope before this enquiry can move forward.';
  let actionKey: AcquisitionActionKey = 'create_intake';
  let waitingExternally = false;

  if (input.hasSession && !submitted && !converted) {
    stageIndex = 1;
    currentState = 'Waiting for customer';
    nextAction = 'Wait for customer scope';
    nextReason = 'The secure technical intake is with the customer. No internal action is needed yet.';
    actionKey = 'wait_customer';
    waitingExternally = true;
  }

  if (submitted && !input.hasPartnerRequest && !converted && !closed) {
    stageIndex = 2;
    currentState = qualified ? 'Partner assessment still required' : 'Customer scope received';
    nextAction = 'Send Partner assessment';
    nextReason = qualified
      ? 'This enquiry has an older qualified flag, but Partner feasibility, price and Go / No-Go evidence are still required.'
      : 'The customer scope is ready for feasibility, capacity and price assessment by an approved Execution Partner.';
    actionKey = 'request_partner';
  }

  if (input.hasPartnerRequest && ['draft','invited','opened','in_progress'].includes(partnerStatus) && !converted) {
    stageIndex = 3;
    currentState = partnerStatus === 'opened' || partnerStatus === 'in_progress' ? 'Partner is assessing' : 'Waiting for Partner';
    nextAction = 'Wait for Partner';
    nextReason = 'The Execution Partner is assessing feasibility, capacity and price. No internal decision is due yet.';
    actionKey = 'wait_partner';
    waitingExternally = true;
  }

  if (input.hasPartnerResponse && partnerStatus === 'submitted' && !input.partnerDecision && !converted) {
    stageIndex = 4;
    currentState = 'Partner assessment received';
    nextAction = 'Record Go / No-Go';
    nextReason = input.hasPartnerPricing
      ? 'Partner feasibility, delivery position and price are ready for your decision.'
      : 'The Partner assessment is present, but the required Partner price is missing.';
    actionKey = 'review_partner_response';
  }

  if (input.partnerDecision === 'clarification_required' && !converted) {
    stageIndex = 5;
    currentState = 'More Partner information needed';
    nextAction = 'Resolve Partner clarification';
    nextReason = 'This enquiry stays in Acquisition until the requested information is received and reviewed.';
    actionKey = 'resolve_clarification';
    waitingExternally = true;
  }

  if (partnerApproved && !converted && !closed) {
    stageIndex = 5;
    currentState = 'Ready to create Case';
    nextAction = 'Create Case 360';
    nextReason = 'Partner assessment, Partner price and Go / No-Go approval are complete. Case 360 can now take over.';
    actionKey = 'create_case';
  }

  if (closed) {
    stageIndex = 5;
    currentState = 'Enquiry closed';
    nextAction = 'No further action';
    nextReason = 'The Go / No-Go decision closed this enquiry.';
    actionKey = 'closed';
  }

  if (converted) {
    stageIndex = 6;
    currentState = 'Case 360 created';
    nextAction = 'Open Case 360';
    nextReason = input.convertedCaseId
      ? 'Acquisition is complete. Case 360 now owns scope formalisation and the commercial offer.'
      : 'Acquisition is complete, but the Case reference needs to be resolved.';
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
