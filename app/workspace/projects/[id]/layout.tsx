import type { ReactNode } from 'react';
import { requireUserContext } from '@/lib/auth/context';
import DocumentGenerationPanel from '@/components/workspace/documents/DocumentGenerationPanel';

const stageLabels: Record<string,string> = {
  mobilisation: 'Mobilisation',
  ready_for_execution: 'Ready for execution',
  in_progress: 'In progress',
  internal_review: 'Internal review',
  partner_correction: 'Partner correction',
  ready_for_client_issue: 'Ready for client issue',
  issued_to_client: 'Issued to client',
  client_review: 'Client review',
  completion: 'Completion',
  closed: 'Closed',
};

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organisationId } = await requireUserContext();
  const { data: project } = await supabase.from('projects').select('id,quote_id,project_stage,status').eq('organisation_id', organisationId).eq('id', id).maybeSingle();
  const stage = project?.project_stage || 'mobilisation';
  const atCompletion = ['completion','closed'].includes(stage);
  const atRelease = ['ready_for_client_issue','issued_to_client','client_review','completion','closed'].includes(stage);
  const atMobilisation = ['mobilisation','ready_for_execution'].includes(stage);
  const atInternalReview = ['internal_review','partner_correction','ready_for_client_issue','issued_to_client','client_review','completion','closed'].includes(stage);

  const items = [
    {
      slug: 'scope-of-work' as const,
      enabled: true,
      requiredNow: ['mobilisation','ready_for_execution'].includes(stage),
      minimumStatus: 'approved' as const,
      reason: 'The approved scope is the controlled boundary for mobilisation and execution.',
    },
    {
      slug: 'statement-of-work' as const,
      enabled: true,
      requiredNow: atMobilisation,
      minimumStatus: 'approved' as const,
      reason: 'Confirm delivery responsibilities, programme, acceptance and change control before execution.',
    },
    {
      slug: 'handover-pack' as const,
      enabled: atMobilisation || atRelease,
      requiredNow: atRelease,
      minimumStatus: 'issued' as const,
      reason: atRelease ? 'The client release package must reach Issued before delivery can be treated as formally transmitted.' : 'Prepare the mobilisation and delivery handover package.',
      blockedReason: 'The Handover Pack becomes available at mobilisation and client-release stages.',
    },
    {
      slug: 'document-register' as const,
      enabled: true,
      requiredNow: atInternalReview,
      minimumStatus: 'approved' as const,
      reason: 'Maintain an approved register of the controlled documents and deliverables forming the project record.',
    },
    {
      slug: 'technical-review' as const,
      enabled: atInternalReview,
      requiredNow: stage === 'internal_review',
      minimumStatus: 'approved' as const,
      reason: 'Record the internal technical and QA review before client issue.',
      blockedReason: 'Internal review evidence becomes available once execution reaches the review stage.',
    },
    {
      slug: 'completion-report' as const,
      enabled: atCompletion,
      requiredNow: atCompletion,
      minimumStatus: 'issued' as const,
      reason: 'Publish completed scope, delivered files, deviations and completion declaration as an issued record.',
      blockedReason: 'Advance the project to Completion first.',
    },
    {
      slug: 'invoice' as const,
      enabled: atCompletion && Boolean(project?.quote_id),
      requiredNow: atCompletion && Boolean(project?.quote_id),
      minimumStatus: 'issued' as const,
      reason: 'Create and issue the controlled billing document from the accepted quote and completed project.',
      blockedReason: 'Completion and a linked accepted quote are required.',
    },
  ];

  return <>
    {children}
    {project ? <DocumentGenerationPanel
      context="project"
      recordId={id}
      quoteId={project.quote_id}
      returnTo={`/workspace/projects/${id}`}
      stageLabel={stageLabels[stage] || stage.replaceAll('_',' ')}
      items={items}
    /> : null}
  </>;
}
