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
  const quoteExists=Boolean(input.quoteStatus);
  const stageLabel=quoteExists
    ? 'Commercial · Client quotation'
    : input.commercialApproved
      ? 'Commercial · Approval'
      : input.partnerResponseReady
        ? 'Assess · Partner response'
        : input.scopeApproved
          ? 'Assess · Partner engagement'
          : input.hasIntake
            ? 'Acquire · Technical definition'
            : 'Acquire · Lead intake';

  return {stageLabel,items:[
    {slug:'client-requirements',enabled:input.hasIntake,requiredNow:input.hasIntake&&!input.scopeApproved,minimumStatus:'approved',reason:'Publish the inherited customer requirement and clarification basis as the approved technical-input record.',blockedReason:'Create the technical intake first.'},
    {slug:'scope-of-work',enabled:input.scopeApproved,requiredNow:input.scopeApproved&&!input.hasReview,minimumStatus:'approved',reason:'Publish the approved technical and delivery scope before controlled partner engagement.',blockedReason:'Approve the technical intake first.'},
    {slug:'vendor-safe-package',enabled:input.scopeApproved,requiredNow:input.scopeApproved&&!input.partnerResponseReady,minimumStatus:'issued',reason:'Issue the controlled partner-facing scope and authorised document package.',blockedReason:'Approve the technical intake first.'},
    {slug:'partner-technical-assessment-report',enabled:input.partnerResponseReady,requiredNow:input.partnerResponseReady&&!input.commercialApproved,minimumStatus:'approved',reason:'Approve the partner feasibility, capacity, assumptions, risks and pricing-readiness evidence.',blockedReason:'A partner review response is required.'},
    {slug:'commercial-approval',enabled:input.commercialApproved,requiredNow:input.commercialApproved&&!quoteExists,minimumStatus:'approved',reason:'Retain the approved internal cost, price, margin and commercial decision before client quotation.',blockedReason:'Approve the commercial position first.'},
    {slug:'client-quote',enabled:quoteExists,requiredNow:quoteExists,minimumStatus:'approved',reason:input.quoteStatus==='issued'?'The commercial quote has been issued. The approved controlled quotation remains the authoritative supporting document for this live commercial state.':'Sign and approve the controlled quotation before commercial issue to the client.',blockedReason:'Generate the client quote first.'},
    {slug:'statement-of-work',enabled:input.scopeApproved&&quoteExists,requiredNow:input.quoteStatus==='accepted',minimumStatus:'approved',reason:'Publish the agreed scope, responsibilities, programme and change-control basis for project mobilisation.',blockedReason:'Approved scope and client quotation are required.'},
  ]};
}
