'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { projectStages, type ProjectStage } from '@/lib/projects/stages';

const roles = ['owner','admin','operator','engineering','commercial'] as const;

export async function advanceProjectStageAction(formData: FormData) {
  const projectId = String(formData.get('project_id') || '');
  const targetStage = String(formData.get('target_stage') || '') as ProjectStage;
  const note = String(formData.get('note') || '').trim();

  if (!projectId || !projectStages.includes(targetStage)) {
    redirect(`/workspace/projects/${projectId}?error=${encodeURIComponent('Invalid project stage request.')}`);
  }

  try {
    const { supabase, user, profile } = await requireUserContext();
    assertRole(profile.role, [...roles]);
    const { error } = await supabase.rpc('op_advance_project_stage', {
      p_project_id: projectId,
      p_target_stage: targetStage,
      p_actor_id: user.id,
      p_note: note || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/workspace/projects/${projectId}`);
    revalidatePath('/workspace/projects');
    redirect(`/workspace/projects/${projectId}?advanced=${targetStage}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Project stage could not be advanced.';
    redirect(`/workspace/projects/${projectId}?error=${encodeURIComponent(message)}`);
  }
}
