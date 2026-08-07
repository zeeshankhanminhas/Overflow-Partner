import type { ClientQuote, CommercialReview, PartnerQuote, Project, TechnicalIntake } from '@/types/domain';
import type { WorkflowStage } from '@/types/orchestration';
import { normaliseProjectStage } from '@/lib/projects/stages';

export type BusinessLifecycleStage = 'acquire' | 'assess' | 'commercial' | 'deliver' | 'close';

export function deriveWorkflowStage(
  intake: TechnicalIntake | null,
  partnerQuote: PartnerQuote | null,
  commercialReview: CommercialReview | null,
  clientQuote: ClientQuote | null,
  project: Project | null,
): { stage: WorkflowStage; nextAction: string } {
  if (project) return { stage: 'project', nextAction: 'Manage delivery and controlled documents' };
  if (clientQuote) {
    if (clientQuote.status === 'draft' || clientQuote.status === 'internal_review') {
      return { stage: 'client_quote', nextAction: 'Review and issue client quote' };
    }
    if (clientQuote.status === 'issued') return { stage: 'client_quote', nextAction: 'Record client acceptance or decline' };
    return { stage: 'client_quote', nextAction: 'Review quote outcome' };
  }
  if (commercialReview) return { stage: 'commercial_review', nextAction: 'Approve commercial position' };
  if (partnerQuote) return { stage: 'partner_pricing', nextAction: 'Create commercial review from compliant partner response' };
  if (intake) return { stage: 'technical_intake', nextAction: intake.status === 'approved' ? 'Select an NDA-compliant execution partner' : 'Review and approve inherited technical scope' };
  return { stage: 'lead', nextAction: 'Create inherited technical scope' };
}

export function lifecycleFromProject(project: Pick<Project, 'status'> & { project_stage?: string | null }): BusinessLifecycleStage {
  const stage = normaliseProjectStage(project.project_stage);
  return stage === 'completion' || stage === 'closed' || ['completed', 'closed'].includes(project.status)
    ? 'close'
    : 'deliver';
}

export function lifecycleFromWorkflowStage(stage: WorkflowStage, project?: (Pick<Project, 'status'> & { project_stage?: string | null }) | null): BusinessLifecycleStage {
  if (stage === 'project') return project ? lifecycleFromProject(project) : 'deliver';
  if (['partner_pricing', 'commercial_review', 'client_quote'].includes(stage)) return 'commercial';
  if (['lead', 'technical_intake'].includes(stage)) return 'assess';
  return 'assess';
}
