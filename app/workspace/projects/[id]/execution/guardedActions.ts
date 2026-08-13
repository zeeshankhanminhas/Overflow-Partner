'use server';

import { redirect } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { assertProjectStartPaymentReceived } from '@/lib/finance/startPayment';
import { generateExecutionLinkAction, releasePartnerExecutionAction } from './actions';

function executionUrl(projectId: string, params: Record<string,string>) {
  return `/workspace/projects/${projectId}/execution?${new URLSearchParams(params).toString()}`;
}

async function assertPaidProject(formData: FormData) {
  const projectId = String(formData.get('project_id') || '').trim();
  if (!projectId) throw new Error('Project is required.');
  const { supabase, organisationId } = await requireUserContext();
  await assertProjectStartPaymentReceived(supabase, organisationId, projectId);
  return projectId;
}

export async function guardedReleasePartnerExecutionAction(formData: FormData) {
  let projectId = String(formData.get('project_id') || '').trim();
  try {
    projectId = await assertPaidProject(formData);
  } catch (error) {
    redirect(executionUrl(projectId, { error: error instanceof Error ? error.message : 'Client start payment must be received before Partner release.' }));
  }
  return releasePartnerExecutionAction(formData);
}

export async function guardedGenerateExecutionLinkAction(formData: FormData) {
  let projectId = String(formData.get('project_id') || '').trim();
  try {
    projectId = await assertPaidProject(formData);
  } catch (error) {
    redirect(executionUrl(projectId, { error: error instanceof Error ? error.message : 'Client start payment must remain satisfied before Partner access can be replaced.' }));
  }
  return generateExecutionLinkAction(formData);
}
