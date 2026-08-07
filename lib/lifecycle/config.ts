export type LifecycleStageKey = 'acquire' | 'assess' | 'commercial' | 'deliver' | 'close';
export type LifecycleSubstage = {
  key: string;
  label: string;
  href: string;
  description: string;
};
export type StageDocumentRequirement = {
  key: string;
  label: string;
  aliases: string[];
  minimumStatus: 'draft' | 'signed' | 'approved' | 'issued';
  required: boolean;
  description: string;
};

export const lifecycleStages: Record<LifecycleStageKey, {
  number: string;
  label: string;
  description: string;
  substages: LifecycleSubstage[];
}> = {
  acquire: {
    number: '01',
    label: 'Acquire',
    description: 'Capture and qualify a genuine engineering requirement.',
    substages: [
      { key: 'prospects', label: 'Prospects', href: '/workspace/acquisition', description: 'Incoming opportunities and source capture.' },
      { key: 'intake', label: 'Technical Intake', href: '/workspace/acquisition', description: 'Collect the structured engineering requirement.' },
    ],
  },
  assess: {
    number: '02',
    label: 'Assess',
    description: 'Establish technical feasibility, evidence and partner capacity.',
    substages: [
      { key: 'case360', label: 'Case 360', href: '/workspace/leads', description: 'Primary operating workspace before acceptance.' },
      { key: 'partner-review', label: 'Partner Review', href: '/workspace/leads', description: 'Controlled execution-partner technical assessment.' },
    ],
  },
  commercial: {
    number: '03',
    label: 'Commercial',
    description: 'Convert approved technical evidence into a controlled client offer.',
    substages: [
      { key: 'partner-pricing', label: 'Partner Pricing', href: '/workspace/leads', description: 'External delivery cost and lead-time basis.' },
      { key: 'client-quotes', label: 'Client Quotes', href: '/workspace/leads', description: 'Approved commercial position and controlled quotation.' },
      { key: 'approvals', label: 'Approvals', href: '/workspace/documents', description: 'Sign, approve and issue controlled documents.' },
    ],
  },
  deliver: {
    number: '04',
    label: 'Deliver',
    description: 'Mobilise, execute, review and issue engineering deliverables.',
    substages: [
      { key: 'projects', label: 'Project 360', href: '/workspace/projects', description: 'Controlled delivery workspace.' },
      { key: 'activities', label: 'Activities', href: '/workspace/projects', description: 'Governed execution and review activities.' },
      { key: 'deliverables', label: 'Deliverables', href: '/workspace/documents', description: 'Controlled engineering outputs and client issue.' },
    ],
  },
  close: {
    number: '05',
    label: 'Close',
    description: 'Complete handover, archive evidence and formally close delivery.',
    substages: [
      { key: 'closeout', label: 'Closeout', href: '/workspace/projects', description: 'Completion evidence and handover.' },
      { key: 'archive', label: 'Archive', href: '/workspace/documents', description: 'Final controlled record and superseded revisions.' },
    ],
  },
};

export const caseDocumentRequirements: Record<'acquire'|'assess'|'commercial', StageDocumentRequirement[]> = {
  acquire: [
    { key: 'technical-intake', label: 'Technical Intake', aliases: ['technical-intake','technical_intake','intake'], minimumStatus: 'draft', required: true, description: 'Structured client requirement and delivery context.' },
  ],
  assess: [
    { key: 'technical-assessment', label: 'Technical Assessment', aliases: ['technical-assessment','technical_assessment','assessment'], minimumStatus: 'approved', required: true, description: 'Internal technical decision based on submitted evidence.' },
    { key: 'partner-review', label: 'Partner Review Record', aliases: ['partner-review','partner_review','partner-assessment','partner_assessment'], minimumStatus: 'approved', required: true, description: 'Execution-partner feasibility, capacity and assumptions.' },
  ],
  commercial: [
    { key: 'partner-pricing', label: 'Partner Pricing Record', aliases: ['partner-pricing','partner_pricing','partner-quote','partner_quote'], minimumStatus: 'approved', required: true, description: 'Approved external cost and delivery basis.' },
    { key: 'commercial-review', label: 'Commercial Review', aliases: ['commercial-review','commercial_review'], minimumStatus: 'approved', required: true, description: 'Margin, selling-price and commercial decision evidence.' },
    { key: 'client-quote', label: 'Client Quotation', aliases: ['client-quote','client_quote','quote'], minimumStatus: 'issued', required: true, description: 'Controlled client offer; must be signed, approved and issued.' },
  ],
};

export const projectDocumentRequirements: Record<string, StageDocumentRequirement[]> = {
  mobilisation: [
    { key: 'scope-of-work', label: 'Scope of Work', aliases: ['scope-of-work','scope_of_work','sow'], minimumStatus: 'approved', required: true, description: 'Approved delivery scope governing mobilisation.' },
    { key: 'project-plan', label: 'Project Delivery Plan', aliases: ['project-plan','project_plan','delivery-plan','delivery_plan'], minimumStatus: 'draft', required: false, description: 'Delivery sequence, responsibilities and dates.' },
  ],
  ready_for_execution: [
    { key: 'scope-of-work', label: 'Scope of Work', aliases: ['scope-of-work','scope_of_work','sow'], minimumStatus: 'approved', required: true, description: 'Approved technical and delivery boundary.' },
    { key: 'partner-package', label: 'Partner Delivery Package', aliases: ['partner-package','partner_package','execution-package','execution_package'], minimumStatus: 'issued', required: false, description: 'Controlled package issued to the execution partner.' },
  ],
  in_progress: [
    { key: 'working-deliverable', label: 'Working Deliverable', aliases: ['working-deliverable','working_deliverable','deliverable'], minimumStatus: 'draft', required: false, description: 'Current controlled engineering output.' },
  ],
  internal_review: [
    { key: 'internal-review-record', label: 'Internal Review Record', aliases: ['internal-review-record','internal_review_record','qa-review','qa_review'], minimumStatus: 'approved', required: true, description: 'Evidence that deliverables passed internal technical review.' },
    { key: 'qa-checklist', label: 'QA Checklist', aliases: ['qa-checklist','qa_checklist','quality-checklist','quality_checklist'], minimumStatus: 'approved', required: false, description: 'Supporting quality-control evidence.' },
  ],
  partner_correction: [
    { key: 'correction-request', label: 'Correction Request', aliases: ['correction-request','correction_request','review-comments','review_comments'], minimumStatus: 'issued', required: false, description: 'Controlled correction instructions and review comments.' },
  ],
  ready_for_client_issue: [
    { key: 'client-deliverable', label: 'Client Deliverable', aliases: ['client-deliverable','client_deliverable','final-deliverable','final_deliverable','deliverable'], minimumStatus: 'issued', required: true, description: 'Approved engineering output ready for controlled client issue.' },
    { key: 'transmittal', label: 'Document Transmittal', aliases: ['transmittal','document-transmittal','document_transmittal'], minimumStatus: 'issued', required: false, description: 'Formal record of what was issued and when.' },
  ],
  issued_to_client: [
    { key: 'client-deliverable', label: 'Issued Client Deliverable', aliases: ['client-deliverable','client_deliverable','final-deliverable','final_deliverable','deliverable'], minimumStatus: 'issued', required: true, description: 'Current client-issued controlled revision.' },
  ],
  client_review: [
    { key: 'client-review-record', label: 'Client Review Record', aliases: ['client-review-record','client_review_record','client-approval','client_approval'], minimumStatus: 'draft', required: false, description: 'Client comments, acceptance or requested changes.' },
  ],
  completion: [
    { key: 'completion-report', label: 'Completion Report', aliases: ['completion-report','completion_report','handover-report','handover_report'], minimumStatus: 'issued', required: true, description: 'Formal evidence that delivery is complete.' },
    { key: 'closeout-pack', label: 'Closeout Pack', aliases: ['closeout-pack','closeout_pack','handover-pack','handover_pack'], minimumStatus: 'approved', required: false, description: 'Final controlled project record for handover and archive.' },
  ],
  closed: [
    { key: 'closeout-pack', label: 'Archived Closeout Pack', aliases: ['closeout-pack','closeout_pack','handover-pack','handover_pack'], minimumStatus: 'issued', required: true, description: 'Final project record retained after closure.' },
  ],
};

const statusRank: Record<string, number> = { draft: 1, in_review: 2, changes_requested: 2, signed: 3, approved: 4, issued: 5, published: 5, archived: 6 };
export function documentMeetsStatus(status: string | null | undefined, minimum: StageDocumentRequirement['minimumStatus']) {
  return (statusRank[String(status || 'draft')] || 0) >= (statusRank[minimum] || 0);
}

export function matchesDocumentType(documentType: string | null | undefined, requirement: StageDocumentRequirement) {
  const normalised = String(documentType || '').trim().toLowerCase();
  return requirement.aliases.some(alias => normalised === alias || normalised.includes(alias));
}
