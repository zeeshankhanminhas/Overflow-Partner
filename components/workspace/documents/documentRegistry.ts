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
  lifecycle: 'active' | 'dormant';
  dormantReason?: string;
};

const previewOnly = 'Preview only. Live Workspace data is not connected yet.';
const active = 'active' as const;
const dormantReason = 'Dormant: the governed workflow already records this decision or package, so a separate document would duplicate the authoritative record.';

export const workspaceDocuments: WorkspaceDocumentItem[] = [
  { slug: 'partner-technical-assessment-report', title: 'Partner Technical Assessment Report', dataStatus: 'preview-only', lifecycle: active, description: `Controlled partner assessment of feasibility, assumptions, risks, lead time and pricing readiness. ${previewOnly}` },
  { slug: 'commercial-approval', title: 'Internal Commercial Approval Record', dataStatus: 'preview-only', lifecycle: 'dormant', dormantReason, description: `Internal record of partner cost, client price, margin and approval reasoning. ${dormantReason}` },
  { slug: 'client-quote', title: 'Client Quotation', dataStatus: 'preview-only', lifecycle: active, description: `Client quotation showing scope, price, delivery and payment terms without internal cost or margin. ${previewOnly}` },
  { slug: 'scope-of-work', title: 'Scope of Work', dataStatus: 'preview-only', lifecycle: 'dormant', dormantReason: 'Dormant: the approved Technical Scope is the Case boundary and the Statement of Work is the single delivery agreement.', description: `Superseded by the approved Technical Scope in Case 360 and the Statement of Work in Project 360.` },
  { slug: 'client-requirements', title: 'Client Requirements Record', dataStatus: 'preview-only', lifecycle: active, description: `Controlled record of confirmed requirements, assumptions, missing information and open questions. ${previewOnly}` },
  { slug: 'vendor-safe-package', title: 'Partner-Safe Package Cover Sheet', dataStatus: 'preview-only', lifecycle: 'dormant', dormantReason, description: `Controlled index of technical information and files released to an assigned Delivery Partner. ${dormantReason}` },
  { slug: 'vendor-instructions', title: 'Delivery Partner Instructions', dataStatus: 'preview-only', lifecycle: active, description: `Working, communication, information-security and submission rules for Delivery Partners. ${previewOnly}` },
  { slug: 'rfq-response', title: 'Delivery Partner Quotation', dataStatus: 'preview-only', lifecycle: active, description: `Partner price, lead time, validity and terms for internal commercial review. ${previewOnly}` },
  { slug: 'document-register', title: 'Document Register', dataStatus: 'preview-only', lifecycle: active, description: `Controlled index of documents, revisions, status, owners and authorised recipients. ${previewOnly}` },
  { slug: 'commercial-qualification-record', title: 'Commercial Qualification Record', dataStatus: 'live-backed', lifecycle: active, description: 'Live internal decision record built from the Case, Technical Intake and Partner Technical Assessment.' },
  { slug: 'capability-statement', title: 'Capability Statement', dataStatus: 'preview-only', lifecycle: active, description: `Overview of Overflow Partner services and delivery model. ${previewOnly}` },
  { slug: 'proposal', title: 'Proposal', dataStatus: 'preview-only', lifecycle: active, description: `Recommended engineering approach before final quotation. ${previewOnly}` },
  { slug: 'statement-of-work', title: 'Statement of Work', dataStatus: 'preview-only', lifecycle: active, description: `Delivery-governing scope, responsibilities, milestones, acceptance criteria and change control. ${previewOnly}` },
  { slug: 'handover-pack', title: 'Delivery Handover Pack', dataStatus: 'preview-only', lifecycle: active, description: `Approved commercial and technical baseline prepared for the start of delivery. ${previewOnly}` },
  { slug: 'completion-report', title: 'Completion Report', dataStatus: 'preview-only', lifecycle: active, description: `Controlled summary of delivered work, agreed deviations and completion status. ${previewOnly}` },
  { slug: 'invoice', title: 'Invoice', dataStatus: 'preview-only', lifecycle: active, description: `Client billing and payment document linked to the accepted quotation and project. ${previewOnly}` },
];

export function isDormantWorkspaceDocument(slug: string) {
  return getWorkspaceDocument(slug)?.lifecycle === 'dormant';
}

export const legacyDocumentAliases: Partial<Record<WorkspaceDocumentSlug, WorkspaceDocumentSlug>> = {
  'requirement-sheet': 'client-requirements',
  'technical-review': 'partner-technical-assessment-report',
  quote: 'client-quote',
};

export function getWorkspaceDocument(slug: string) {
  return workspaceDocuments.find((document) => document.slug === slug);
}
