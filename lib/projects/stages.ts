export const projectStages = [
  'mobilisation','ready_for_execution','in_progress','internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review','completion','closed',
] as const;

export type ProjectStage = typeof projectStages[number];

export const projectStageMeta: Record<ProjectStage, { label: string; objective: string; completion: string; next: ProjectStage | null; action: string }> = {
  mobilisation: {
    label: 'Mobilisation',
    objective: 'Set the owner, dates, approved scope and commercial authority for delivery.',
    completion: 'Owner, dates, controlled scope and financial authority are ready.',
    next: 'ready_for_execution',
    action: 'Release to Execution Partner',
  },
  ready_for_execution: {
    label: 'Ready to release',
    objective: 'The approved delivery basis is ready with the Execution Partner.',
    completion: 'Partner commencement received.',
    next: 'in_progress',
    action: 'Await Partner start',
  },
  in_progress: {
    label: 'Partner execution',
    objective: 'Track Partner delivery, progress, exceptions and required outputs.',
    completion: 'Partner delivery received with the required evidence.',
    next: 'internal_review',
    action: 'Review Partner delivery',
  },
  internal_review: {
    label: 'Internal review',
    objective: 'Check technical quality, completeness and readiness for client release.',
    completion: 'Approve the delivery for client release or return it for correction.',
    next: 'ready_for_client_issue',
    action: 'Approve for client release',
  },
  partner_correction: {
    label: 'Partner correction',
    objective: 'The Execution Partner is correcting findings from internal review.',
    completion: 'A revised Partner delivery is ready for review.',
    next: 'in_progress',
    action: 'Return to Partner execution',
  },
  ready_for_client_issue: {
    label: 'Ready to send',
    objective: 'The approved controlled delivery is ready to send to the client.',
    completion: 'Client transmittal is recorded.',
    next: 'issued_to_client',
    action: 'Send approved delivery to client',
  },
  issued_to_client: {
    label: 'Sent to client',
    objective: 'The controlled delivery has been sent and is awaiting client review.',
    completion: 'Client review begins.',
    next: 'client_review',
    action: 'Open client review',
  },
  client_review: {
    label: 'Client review',
    objective: 'Record the client outcome: accepted, comments received or correction required.',
    completion: 'Client outcome recorded and required follow-up resolved.',
    next: 'completion',
    action: 'Record client outcome',
  },
  completion: {
    label: 'Delivery complete',
    objective: 'Confirm final delivery evidence and commercial closeout.',
    completion: 'Final evidence, billing and Partner liability are complete.',
    next: 'closed',
    action: 'Close project',
  },
  closed: {
    label: 'Closed',
    objective: 'The project is technically, commercially and administratively closed.',
    completion: 'No further action required.',
    next: null,
    action: 'Closed',
  },
};

export function normaliseProjectStage(value: unknown): ProjectStage {
  return projectStages.includes(value as ProjectStage) ? value as ProjectStage : 'mobilisation';
}
