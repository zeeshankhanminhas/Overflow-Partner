import { resolveProjectPresentation, type OperatingAction, type OperatingPresentation, type ProjectPresentationInput } from '@/lib/presentation/operatingState';
import { projectPhaseForStage, projectPhaseMeta } from '@/lib/presentation/projectJourney';

function simpleCopy(value?: string) {
  if (!value) return value;
  return value
    .replace(/Cycle\s*\d+\s+delivery received/gi, 'Partner delivery received')
    .replace(/Cycle\s*\d+\s+is ready for internal review/gi, 'Partner delivery is ready for internal review')
    .replace(/Cycle\s*\d+/gi, 'Partner delivery')
    .replace(/current-cycle/gi, 'current')
    .replace(/execution cycle/gi, 'Partner work')
    .replace(/correction cycle/gi, 'requested changes')
    .replace(/this cycle/gi, 'this delivery')
    .replace(/the cycle/gi, 'the delivery');
}

function action(action: OperatingAction): OperatingAction {
  return { ...action, label: simpleCopy(action.label) || action.label, reason: simpleCopy(action.reason) };
}

export function resolveProjectJourneyPresentation(input: ProjectPresentationInput): OperatingPresentation {
  const base = resolveProjectPresentation(input);
  const phase = projectPhaseMeta[projectPhaseForStage(input.stage)].label;
  const partner = input.partnerName || 'Execution Partner';

  let headline = simpleCopy(base.headline) || base.headline;
  let summary = simpleCopy(base.summary) || base.summary;
  const state = phase;

  if (input.stage === 'in_progress' && !input.currentCycleDeliverySubmitted && Number(input.openPartnerExceptions || 0) === 0) {
    headline = `${partner} has the work`;
    summary = 'Engineering work is with the Execution Partner. Overflow Partner only needs to act if the Partner reports an exception or submits delivery.';
  }
  if (input.stage === 'in_progress' && input.currentCycleDeliverySubmitted) {
    headline = 'Partner delivery received';
    summary = Number(input.deliveryWorkOpen || 0) > 0
      ? 'The engineering delivery is back with Overflow Partner. Complete the remaining delivery checks before review.'
      : 'The engineering delivery is back with Overflow Partner and is ready for internal review.';
  }
  if (input.stage === 'partner_correction') {
    headline = input.currentCycleDeliverySubmitted ? 'Revised Partner delivery received' : `${partner} is making requested changes`;
    summary = input.currentCycleDeliverySubmitted
      ? 'The revised engineering delivery is back with Overflow Partner for review.'
      : 'The Partner owns the work until a revised engineering delivery is submitted.';
  }

  return {
    ...base,
    state,
    headline,
    summary,
    nextAction: action(base.nextAction),
    blockers: base.blockers.map(item => simpleCopy(item) || item),
    warnings: base.warnings.map(item => simpleCopy(item) || item),
    completed: base.completed.map(item => simpleCopy(item) || item),
    primaryActions: base.primaryActions.map(action),
  };
}