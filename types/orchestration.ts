import type {
  ClientQuote,
  CommercialReview,
  Lead,
  PartnerQuote,
  Project,
  TechnicalIntake,
} from '@/types/domain';

export type WorkflowStage =
  | 'lead'
  | 'technical_intake'
  | 'partner_pricing'
  | 'commercial_review'
  | 'client_quote'
  | 'project';

export interface WorkflowCase {
  lead: Lead;
  technicalIntake: TechnicalIntake | null;
  partnerQuote: PartnerQuote | null;
  commercialReview: CommercialReview | null;
  clientQuote: ClientQuote | null;
  project: Project | null;
  stage: WorkflowStage;
  nextAction: string;
}
