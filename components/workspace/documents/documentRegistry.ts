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

const previewOnly = 'Preview only until its backend adapter maps live Workspace fields.';
const legacyPreview = 'Legacy preview; final issue must use a live backend adapter before launch use.';

export const workspaceDocuments: WorkspaceDocumentItem[] = [
  { slug: 'partner-technical-assessment-report', title: 'Partner Technical Assessment Report', dataStatus: 'preview-only', description: `Partner-owned feasibility, assumptions, risks, lead time, and pricing-readiness evidence. ${previewOnly}` },
  { slug: 'commercial-approval', title: 'Internal Commercial Approval Record', dataStatus: 'preview-only', description: `Strictly internal gross margin, price approval, and commercial reasoning record. ${previewOnly}` },
  { slug: 'client-quote', title: 'Client Quote', dataStatus: 'preview-only', description: `Client-facing quote content that excludes partner cost, margin, and internal risk notes. ${previewOnly}` },
  { slug: 'scope-of-work', title: 'Scope of Work', dataStatus: 'preview-only', description: `Controlled partner assessment and delivery scope basis. ${previewOnly}` },
  { slug: 'client-requirements', title: 'Client Requirements', dataStatus: 'preview-only', description: `Traceable requirement register with confirmed, assumed, missing, and clarification statuses. ${previewOnly}` },
  { slug: 'vendor-safe-package', title: 'Partner Safe Package Cover Sheet', dataStatus: 'preview-only', description: `Controlled transmittal for partner review with listed documents and authorised files. ${previewOnly}` },
  { slug: 'vendor-instructions', title: 'Partner Instructions', dataStatus: 'preview-only', description: `Partner rules for assessment, pricing, communication, file handling, and confidentiality. ${previewOnly}` },
  { slug: 'rfq-response', title: 'RFQ Response / Partner Pricing', dataStatus: 'preview-only', description: `Structured partner commercial response for Overflow Partner internal margin review. ${previewOnly}` },
  { slug: 'document-register', title: 'Document Register', dataStatus: 'preview-only', description: `Controlled index of Overflow Partner documents, partner records, source files, and generated PDFs. ${previewOnly}` },
  { slug: 'commercial-qualification-record', title: 'Commercial Qualification Record', dataStatus: 'live-backed', description: 'Live-backed internal commercial decision record assembled from Case, Technical Intake, and Partner Technical Assessment records.' },
  { slug: 'capability-statement', title: 'Capability Statement', dataStatus: 'preview-only', description: `Overflow Partner capability and engagement model document. ${previewOnly}` },
  { slug: 'requirement-sheet', title: 'Requirement Sheet', dataStatus: 'legacy-preview', description: `Structured requirement capture and clarification record. ${legacyPreview}` },
  { slug: 'technical-review', title: 'Technical Review', dataStatus: 'legacy-preview', description: `Legacy-compatible preview of technical readiness, risk, and clarification review. ${legacyPreview}` },
  { slug: 'proposal', title: 'Proposal', dataStatus: 'preview-only', description: `Controlled proposal framework before quote or delivery approval. ${previewOnly}` },
  { slug: 'quote', title: 'Quote', dataStatus: 'legacy-preview', description: `Controlled commercial quote document preview. ${legacyPreview}` },
  { slug: 'statement-of-work', title: 'Statement of Work', dataStatus: 'legacy-preview', description: `Scope, inputs, milestones, acceptance, and change control. ${legacyPreview}` },
  { slug: 'handover-pack', title: 'Handover Pack', dataStatus: 'legacy-preview', description: `Controlled delivery package and release notes. ${legacyPreview}` },
  { slug: 'completion-report', title: 'Completion Report', dataStatus: 'legacy-preview', description: `Delivery completion and acceptance summary. ${legacyPreview}` },
  { slug: 'invoice', title: 'Invoice', dataStatus: 'legacy-preview', description: `Controlled project billing document. ${legacyPreview}` },
  { slug: 'email-templates', title: 'Email Templates', dataStatus: 'preview-only', description: `Operational email templates for lifecycle communication. ${previewOnly}` },
];

export function getWorkspaceDocument(slug: string) {
  return workspaceDocuments.find((document) => document.slug === slug);
}
