export type CaseDocumentRequirement = {
  slug:
    | 'client-requirements'
    | 'scope-of-work'
    | 'vendor-safe-package'
    | 'partner-technical-assessment-report'
    | 'commercial-approval'
    | 'client-quote'
    | 'statement-of-work';
  enabled: boolean;
  requiredNow: boolean;
  minimumStatus: 'draft' | 'signed' | 'approved' | 'issued';
  reason: string;
  blockedReason?: string;
};

export function getCaseDocumentRequirements(input: {
  hasIntake: boolean;
  scopeApproved: boolean;
  hasReview: boolean;
  partnerResponseReady: boolean;
  commercialApproved: boolean;
  quoteStatus?: string | null;
}): { stageLabel: string; items: CaseDocumentRequirement[] } {
  const quoteExists = Boolean(input.quoteStatus);
  const stageLabel = quoteExists
    ? 'Commercial · Client quotation'
    : input.commercialApproved
      ? 'Commercial · Approved position'
      : input.scopeApproved
        ? 'Case · Controlled technical basis'
        : input.hasIntake
          ? 'Case · Customer requirements'
          : 'Case · Technical intake';

  return {
    stageLabel,
    items: [
      {
        slug: 'client-requirements',
        enabled: input.hasIntake,
        requiredNow: input.hasIntake && !input.scopeApproved,
        minimumStatus: 'approved',
        reason: 'Publish the inherited Step 2 requirement and clarification basis as the approved customer-input record before Technical Scope approval.',
        blockedReason: 'Create the inherited Technical Intake first.',
      },
      {
        slug: 'scope-of-work',
        enabled: input.scopeApproved,
        requiredNow: input.scopeApproved && !input.commercialApproved && !quoteExists,
        minimumStatus: 'approved',
        reason: 'Formalise the controlled technical and delivery boundary before the partner cost becomes an Overflow Partner commercial position.',
        blockedReason: 'Approve the Technical Scope first.',
      },
      {
        slug: 'partner-technical-assessment-report',
        enabled: input.partnerResponseReady,
        requiredNow: input.partnerResponseReady && !input.commercialApproved && !quoteExists,
        minimumStatus: 'approved',
        reason: 'Publish the inherited partner feasibility, capacity, assumptions, risks and pricing-readiness evidence before commercial progression.',
        blockedReason: 'The governed Acquisition Partner Review must be inherited first.',
      },
      {
        slug: 'vendor-safe-package',
        enabled: input.scopeApproved,
        requiredNow: false,
        minimumStatus: 'issued',
        reason: 'Optional controlled publication for any additional partner-facing package. The canonical pre-commercial Partner Review is already completed in Acquisition.',
        blockedReason: 'Approve the Technical Scope first.',
      },
      {
        slug: 'commercial-approval',
        enabled: input.commercialApproved,
        requiredNow: false,
        minimumStatus: 'approved',
        reason: 'Optional publication of the approved commercial position. The Commercial Review record itself is the governed approval authority.',
        blockedReason: 'Approve the Commercial Review first.',
      },
      {
        slug: 'client-quote',
        enabled: quoteExists,
        requiredNow: quoteExists,
        minimumStatus: 'approved',
        reason: input.quoteStatus === 'issued'
          ? 'The issued controlled quotation remains the authoritative commercial publication while the client decision is pending.'
          : 'Approve the canonical controlled Client Quote before commercial issue.',
        blockedReason: 'Generate the Client Quote first.',
      },
      {
        slug: 'statement-of-work',
        enabled: false,
        requiredNow: false,
        minimumStatus: 'approved',
        reason: 'Statement of Work belongs to Project 360 mobilisation after written client acceptance.',
        blockedReason: 'Create Project 360 from governed client acceptance first.',
      },
    ],
  };
}
