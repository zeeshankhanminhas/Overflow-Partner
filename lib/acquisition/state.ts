export const acquisitionStages = [
  'Prospect captured',
  'Intake requested',
  'Customer submitted',
  'Technical review',
  'Qualified',
  'Case created',
] as const;

export type AcquisitionActionKey =
  | 'create_intake'
  | 'wait_customer'
  | 'review_submission'
  | 'create_case'
  | 'open_case';

export type AcquisitionStateInput = {
  prospectStatus?: string | null;
  hasSession: boolean;
  sessionStatus?: string | null;
  hasSubmission: boolean;
  convertedCaseId?: string | null;
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
    qualification: 'Pending' | 'Qualified' | 'Converted';
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

  let stageIndex = 0;
  let currentState = 'Prospect captured';
  let nextAction = 'Create technical intake';
  let nextReason = 'Structured technical evidence is required before this opportunity can be qualified.';
  let actionKey: AcquisitionActionKey = 'create_intake';
  let waitingExternally = false;

  if (input.hasSession && !submitted && !converted) {
    stageIndex = 1;
    currentState = 'Awaiting customer technical intake';
    nextAction = 'Wait for customer submission';
    nextReason = 'The technical intake has been issued and remains with the customer.';
    actionKey = 'wait_customer';
    waitingExternally = true;
  }

  if (submitted && !qualified && !converted) {
    stageIndex = 3;
    currentState = 'Technical review required';
    nextAction = 'Record technical partner review';
    nextReason = 'The submitted technical brief now needs an engineering qualification decision.';
    actionKey = 'review_submission';
  }

  if (qualified && !converted) {
    stageIndex = 4;
    currentState = 'Qualified for Case creation';
    nextAction = 'Create governed Case 360';
    nextReason = 'Technical qualification is complete and the opportunity may enter the governed Case lifecycle.';
    actionKey = 'create_case';
  }

  if (converted) {
    stageIndex = 5;
    currentState = 'Converted to Case 360';
    nextAction = 'Continue in Case 360';
    nextReason = input.convertedCaseId
      ? 'Acquisition is complete for this prospect. Continue on the governed Case record.'
      : 'Acquisition is complete for this prospect. The converted Case reference needs to be resolved.';
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
      qualification: converted ? 'Converted' : qualified ? 'Qualified' : 'Pending',
    },
  };
}
