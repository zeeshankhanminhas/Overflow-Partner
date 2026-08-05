import type { ReactNode } from 'react';
import { requireUserContext } from '@/lib/auth/context';
import DocumentGenerationPanel from '@/components/workspace/documents/DocumentGenerationPanel';

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organisationId } = await requireUserContext();
  const { data: project } = await supabase.from('projects').select('id,quote_id,project_stage,status').eq('organisation_id', organisationId).eq('id', id).maybeSingle();
  const stage = project?.project_stage || 'mobilisation';
  const atCompletion = ['completion','closed'].includes(stage);
  const atRelease = ['ready_for_client_issue','issued_to_client','client_review','completion','closed'].includes(stage);

  const items = [
    { slug: 'scope-of-work' as const, enabled: true, reason: 'Publish the inherited approved scope within the active project record.' },
    { slug: 'statement-of-work' as const, enabled: true, reason: 'Create the controlled delivery responsibilities, programme and change-control document.' },
    { slug: 'handover-pack' as const, enabled: ['mobilisation','ready_for_execution'].includes(stage) || atRelease, reason: atRelease ? 'Create the controlled client release and deliverable handover pack.' : 'Create the mobilisation and delivery handover package.', blockedReason: 'The Handover Pack is not permitted at the current stage.' },
    { slug: 'completion-report' as const, enabled: atCompletion, reason: 'Publish the completed scope, delivered files, deviations and completion declaration.', blockedReason: 'Advance the project to Completion first.' },
    { slug: 'invoice' as const, enabled: atCompletion && Boolean(project?.quote_id), reason: 'Create the controlled billing document from the accepted quote and completed project.', blockedReason: 'Completion and a linked accepted quote are required.' },
    { slug: 'document-register' as const, enabled: true, reason: 'Publish the current controlled document and deliverable register.' },
  ];

  return <>
    {children}
    {project ? <DocumentGenerationPanel context="project" recordId={id} quoteId={project.quote_id} returnTo={`/workspace/projects/${id}`} items={items}/> : null}
  </>;
}
