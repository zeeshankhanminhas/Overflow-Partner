export type ProjectDocumentRequirement = {
  slug:
    | 'scope-of-work'
    | 'statement-of-work'
    | 'handover-pack'
    | 'document-register'
    | 'technical-review'
    | 'completion-report'
    | 'invoice';
  enabled: boolean;
  requiredNow: boolean;
  minimumStatus: 'draft' | 'signed' | 'approved' | 'issued';
  reason: string;
  blockedReason?: string;
};

export function getProjectDocumentRequirements(stage: string, hasAcceptedQuote: boolean): ProjectDocumentRequirement[] {
  const atCompletion = ['completion', 'closed'].includes(stage);
  const atRelease = ['ready_for_client_issue', 'issued_to_client', 'client_review', 'completion', 'closed'].includes(stage);
  const atMobilisation = ['mobilisation', 'ready_for_execution'].includes(stage);
  const atInternalReview = ['internal_review', 'partner_correction', 'ready_for_client_issue', 'issued_to_client', 'client_review', 'completion', 'closed'].includes(stage);

  return [
    {
      slug: 'scope-of-work',
      enabled: true,
      requiredNow: atMobilisation,
      minimumStatus: 'approved',
      reason: 'The approved scope is the controlled boundary for mobilisation and execution.',
    },
    {
      slug: 'statement-of-work',
      enabled: true,
      requiredNow: atMobilisation,
      minimumStatus: 'approved',
      reason: 'Confirm delivery responsibilities, programme, acceptance and change control before execution.',
    },
    {
      slug: 'handover-pack',
      enabled: atMobilisation || atRelease,
      requiredNow: atRelease,
      minimumStatus: 'issued',
      reason: atRelease
        ? 'The client release package must reach Issued before delivery can be treated as formally transmitted.'
        : 'Prepare the mobilisation and delivery handover package.',
      blockedReason: 'The Handover Pack becomes available at mobilisation and client-release stages.',
    },
    {
      slug: 'document-register',
      enabled: true,
      requiredNow: atInternalReview,
      minimumStatus: 'approved',
      reason: 'Maintain an approved register of the controlled documents and deliverables forming the project record.',
    },
    {
      slug: 'technical-review',
      enabled: atInternalReview,
      requiredNow: stage === 'internal_review',
      minimumStatus: 'approved',
      reason: 'Record the internal technical and QA review before client issue.',
      blockedReason: 'Internal review evidence becomes available once execution reaches the review stage.',
    },
    {
      slug: 'completion-report',
      enabled: atCompletion,
      requiredNow: atCompletion,
      minimumStatus: 'issued',
      reason: 'Publish completed scope, delivered files, deviations and completion declaration as an issued record.',
      blockedReason: 'Advance the project to Completion first.',
    },
    {
      slug: 'invoice',
      enabled: atCompletion && hasAcceptedQuote,
      requiredNow: atCompletion && hasAcceptedQuote,
      minimumStatus: 'issued',
      reason: 'Create and issue the controlled billing document from the accepted quote and completed project.',
      blockedReason: 'Completion and a linked accepted quote are required.',
    },
  ];
}
