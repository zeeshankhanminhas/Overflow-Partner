import type { WorkspaceDocumentSlug } from './documentRegistry';

export type DocumentEvidenceKey =
  | 'clientIdentity' | 'technicalIntake' | 'partnerAssessment' | 'partnerQuote'
  | 'commercialApproval' | 'clientQuote' | 'acceptedQuote' | 'project'
  | 'deliveryEvidence' | 'documentControl' | 'invoice';

export type DocumentDataContract = {
  canonical: boolean;
  required: DocumentEvidenceKey[];
  purpose: 'internal' | 'client' | 'partner' | 'project' | 'finance' | 'marketing';
};

const contract = (purpose: DocumentDataContract['purpose'], required: DocumentEvidenceKey[], canonical = true): DocumentDataContract => ({ purpose, required, canonical });

export const documentDataContracts: Record<WorkspaceDocumentSlug, DocumentDataContract> = {
  'capability-statement': contract('marketing', []),
  'client-requirements': contract('client', ['clientIdentity', 'technicalIntake']),
  'scope-of-work': contract('client', ['clientIdentity', 'technicalIntake']),
  'statement-of-work': contract('project', ['clientIdentity', 'technicalIntake', 'acceptedQuote', 'project']),
  'partner-technical-assessment-report': contract('internal', ['technicalIntake', 'partnerAssessment']),
  'vendor-safe-package': contract('partner', ['technicalIntake', 'documentControl']),
  'vendor-instructions': contract('partner', ['technicalIntake', 'project']),
  'rfq-response': contract('internal', ['partnerAssessment', 'partnerQuote']),
  'commercial-approval': contract('internal', ['partnerAssessment', 'partnerQuote', 'commercialApproval']),
  'commercial-qualification-record': contract('internal', ['technicalIntake', 'partnerAssessment', 'commercialApproval']),
  'client-quote': contract('client', ['clientIdentity', 'technicalIntake', 'commercialApproval', 'clientQuote']),
  'proposal': contract('client', ['clientIdentity', 'technicalIntake']),
  'handover-pack': contract('project', ['acceptedQuote', 'project', 'documentControl']),
  'completion-report': contract('project', ['project', 'deliveryEvidence', 'documentControl']),
  'invoice': contract('finance', ['clientIdentity', 'project', 'invoice']),
  'document-register': contract('internal', ['documentControl']),
  'requirement-sheet': contract('internal', ['technicalIntake'], false),
  'technical-review': contract('internal', ['partnerAssessment'], false),
  'quote': contract('client', ['clientQuote'], false),
  'email-templates': contract('internal', []),
};

export const evidenceLabels: Record<DocumentEvidenceKey, string> = {
  clientIdentity: 'client legal and contact identity',
  technicalIntake: 'technical intake and defined deliverables',
  partnerAssessment: 'completed Delivery Partner technical assessment',
  partnerQuote: 'Delivery Partner quotation',
  commercialApproval: 'approved commercial review',
  clientQuote: 'client quotation with totals and validity',
  acceptedQuote: 'accepted client quotation',
  project: 'delivery project and ownership',
  deliveryEvidence: 'delivery submissions or client transmittals',
  documentControl: 'controlled document records',
  invoice: 'invoice record with issue and due dates',
};
