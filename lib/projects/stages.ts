export const projectStages = [
  'mobilisation','ready_for_execution','in_progress','internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review','completion','closed',
] as const;

export type ProjectStage = typeof projectStages[number];

export const projectStageMeta: Record<ProjectStage, { label: string; objective: string; completion: string; next: ProjectStage | null; action: string }> = {
  mobilisation: { label: 'Mobilisation', objective: 'Confirm the accepted scope, commercial basis, ownership, dates and delivery controls.', completion: 'Accepted quote linked and project dates recorded.', next: 'ready_for_execution', action: 'Authorise execution' },
  ready_for_execution: { label: 'Ready for execution', objective: 'Confirm that the delivery basis is complete and engineering work may begin.', completion: 'Execution is formally started.', next: 'in_progress', action: 'Start engineering work' },
  in_progress: { label: 'In progress', objective: 'Complete the governed engineering delivery activities.', completion: 'All delivery activities are completed or cancelled.', next: 'internal_review', action: 'Submit for internal review' },
  internal_review: { label: 'Internal review', objective: 'Verify technical quality, completeness and release readiness.', completion: 'Approve for client issue or return for correction.', next: 'ready_for_client_issue', action: 'Approve for client issue' },
  partner_correction: { label: 'Partner correction', objective: 'Resolve the technical or quality findings raised during internal review.', completion: 'Corrections are complete and evidence is ready for re-review or release.', next: 'in_progress', action: 'Return to work in progress' },
  ready_for_client_issue: { label: 'Ready for client issue', objective: 'Confirm controlled deliverables and release authority.', completion: 'At least one approved controlled document is issued.', next: 'issued_to_client', action: 'Record client issue' },
  issued_to_client: { label: 'Issued to client', objective: 'Record the controlled release and move the package into client review.', completion: 'Client review period begins.', next: 'client_review', action: 'Start client review' },
  client_review: { label: 'Client review', objective: 'Capture client acceptance, comments or required corrective action.', completion: 'Client outcome is recorded and all open delivery activities are resolved.', next: 'completion', action: 'Record completion' },
  completion: { label: 'Completion', objective: 'Confirm final delivery evidence, completion publication and commercial closure readiness.', completion: 'Final issued document exists and closure obligations are complete.', next: 'closed', action: 'Close project' },
  closed: { label: 'Closed', objective: 'The project is commercially, technically and administratively closed.', completion: 'No further governed action is required.', next: null, action: 'Closed' },
};

export function normaliseProjectStage(value: unknown): ProjectStage {
  return projectStages.includes(value as ProjectStage) ? value as ProjectStage : 'mobilisation';
}
