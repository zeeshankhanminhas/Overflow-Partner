export type WorkspaceDocumentSlug =
  | 'capability-statement'
  | 'client-quote'
  | 'client-requirements'
  | 'commercial-approval'
  | 'commercial-qualification-record'
  | 'completion-report'
  | 'document-register'
  | 'email-templates'
  | 'handover-pack'
  | 'invoice'
  | 'partner-technical-assessment-report'
  | 'proposal'
  | 'quote'
  | 'requirement-sheet'
  | 'rfq-response'
  | 'scope-of-work'
  | 'statement-of-work'
  | 'technical-review'
  | 'vendor-instructions'
  | 'vendor-safe-package';

export type WorkspaceDocumentItem = {
  slug: WorkspaceDocumentSlug;
  title: string;
  description: string;
  dataStatus: 'live-backed' | 'preview-only' | 'legacy-preview';
};

const previewOnly = 'Preview only. Live Workspace data is not connected yet.';
const legacyPreview = 'Legacy preview. Do not use for final issue until live data is connected.';

export const workspaceDocuments: WorkspaceDocumentItem[] = [
  { slug: 'partner-technical-assessment-report', title: 'Partner Technical Assessment Report', dataStatus: 'preview-only', description: `Partner assessment of feasibility, assumptions, risks, lead time and pricing readiness. ${previewOnly}` },
  { slug: 'commercial-approval', title: 'Internal Commercial Approval Record', dataStatus: 'preview-only', description: `Internal record of partner cost, client price, margin and approval reasoning. ${previewOnly}` },
  { slug: 'client-quote', title: 'Client Quote', dataStatus: 'preview-only', description: `Client quote showing scope, price, delivery and payment terms without internal cost or margin. ${previewOnly}` },
  { slug: 'scope-of-work', title: 'Scope of Work', dataStatus: 'preview-only', description: `Defines the agreed work, deliverables, responsibilities and changes. ${previewOnly}` },
  { slug: 'client-requirements', title: 'Client Requirements', dataStatus: 'preview-only', description: `Records confirmed requirements, assumptions, missing information and open questions. ${previewOnly}` },
  { slug: 'vendor-safe-package', title: 'Partner Safe Package Cover Sheet', dataStatus: 'preview-only', description: `Lists the technical information and files shared with an assigned partner. ${previewOnly}` },
  { slug: 'vendor-instructions', title: 'Partner Instructions', dataStatus: 'preview-only', description: `Working, communication, file-handling and confidentiality rules for partners. ${previewOnly}` },
  { slug: 'rfq-response', title: 'RFQ Response / Partner Pricing', dataStatus: 'preview-only', description: `Partner price, lead time, validity and terms for internal commercial review. ${previewOnly}` },
  { slug: 'document-register', title: 'Document Register', dataStatus: 'preview-only', description: `Index of documents, revisions, status, owners and recipients. ${previewOnly}` },
  { slug: 'commercial-qualification-record', title: 'Commercial Qualification Record', dataStatus: 'live-backed', description: 'Live internal decision record built from the Case, Technical Intake and Partner Technical Assessment.' },
  { slug: 'capability-statement', title: 'Capability Statement', dataStatus: 'preview-only', description: `Overview of Overflow Partner services and delivery model. ${previewOnly}` },
  { slug: 'requirement-sheet', title: 'Requirement Sheet', dataStatus: 'legacy-preview', description: `Initial engineering requirement and clarification record. ${legacyPreview}` },
  { slug: 'technical-review', title: 'Technical Review', dataStatus: 'legacy-preview', description: `Technical readiness, risk and clarification review. ${legacyPreview}` },
  { slug: 'proposal', title: 'Proposal', dataStatus: 'preview-only', description: `Recommended engineering approach before final quotation. ${previewOnly}` },
  { slug: 'quote', title: 'Quote', dataStatus: 'legacy-preview', description: `Price and terms for a defined scope. ${legacyPreview}` },
  { slug: 'statement-of-work', title: 'Statement of Work', dataStatus: 'legacy-preview', description: `Detailed scope, responsibilities, milestones, acceptance and changes. ${legacyPreview}` },
  { slug: 'handover-pack', title: 'Handover Pack', dataStatus: 'legacy-preview', description: `Agreed project information prepared for the start of delivery. ${legacyPreview}` },
  { slug: 'completion-report', title: 'Completion Report', dataStatus: 'legacy-preview', description: `Summary of delivered work, deviations and completion status. ${legacyPreview}` },
  { slug: 'invoice', title: 'Invoice', dataStatus: 'legacy-preview', description: `Project billing and payment document. ${legacyPreview}` },
  { slug: 'email-templates', title: 'Email Templates', dataStatus: 'preview-only', description: `Routine client and partner messages used through the workflow. ${previewOnly}` },
];

export function getWorkspaceDocument(slug: string) {
  return workspaceDocuments.find((document) => document.slug === slug);
}
