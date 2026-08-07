'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { projectStages, type ProjectStage } from '@/lib/projects/stages';

const roles = ['owner','admin','operator','engineering','commercial'] as const;

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}

function projectUrl(projectId: string, params: Record<string,string>) {
  return `/workspace/projects/${projectId}?${new URLSearchParams(params).toString()}`;
}

function refreshProject(projectId: string) {
  revalidatePath(`/workspace/projects/${projectId}`);
  revalidatePath('/workspace/projects');
  revalidatePath('/workspace');
  revalidatePath('/workspace/commercial-control');
  revalidatePath('/workspace/intelligence');
}

export async function updateProjectMobilisationAction(formData: FormData) {
  const projectId = required(formData,'project_id');
  let destination = `/workspace/projects/${projectId}`;
  try {
    const managerId = required(formData,'project_manager_id');
    const startDate = required(formData,'start_date');
    const dueDate = required(formData,'due_date');
    const { supabase,user,profile,organisationId } = await requireUserContext();
    assertRole(profile.role,[...roles]);
    const { error } = await supabase.rpc('op_update_project_mobilisation',{
      p_organisation_id: organisationId,p_user_id:user.id,p_project_id:projectId,p_project_manager_id:managerId,p_start_date:startDate,p_due_date:dueDate,
    });
    if(error) throw new Error(error.message);
    refreshProject(projectId);
    destination=projectUrl(projectId,{updated:'Mobilisation controls saved.'});
  } catch(error) {
    destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Project setup could not be saved.'});
  }
  redirect(destination);
}

export async function createProjectActivityAction(formData: FormData) {
  const projectId=required(formData,'project_id');
  let destination=`/workspace/projects/${projectId}`;
  try {
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...roles]);
    const {error}=await supabase.rpc('op_create_project_activity',{
      p_organisation_id:organisationId,p_user_id:user.id,p_project_id:projectId,
      p_title:required(formData,'title'),p_activity_type:String(formData.get('activity_type')||'delivery'),
      p_owner_id:String(formData.get('owner_id')||'')||null,p_due_at:String(formData.get('due_at')||'')||null,
      p_priority:String(formData.get('priority')||'normal'),p_notes:String(formData.get('notes')||'')||null,
      p_project_stage:String(formData.get('project_stage')||'mobilisation'),p_linked_document_id:String(formData.get('linked_document_id')||'')||null,
    });
    if(error) throw new Error(error.message);
    refreshProject(projectId);
    destination=projectUrl(projectId,{activity:'Activity created.'});
  } catch(error) {
    destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Activity could not be created.'});
  }
  redirect(destination);
}

export async function setProjectActivityStatusAction(formData: FormData) {
  const projectId=required(formData,'project_id');
  let destination=`/workspace/projects/${projectId}`;
  try {
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...roles]);
    const {error}=await supabase.rpc('op_set_project_activity_status',{
      p_organisation_id:organisationId,p_user_id:user.id,p_task_id:required(formData,'task_id'),p_status:required(formData,'status'),
    });
    if(error) throw new Error(error.message);
    refreshProject(projectId);
    destination=projectUrl(projectId,{activity:'Activity status updated.'});
  } catch(error) {
    destination=projectUrl(projectId,{error:error instanceof Error?error.message:'Activity status could not be updated.'});
  }
  redirect(destination);
}

export async function advanceProjectStageAction(formData: FormData) {
  const projectId = String(formData.get('project_id') || '');
  const submittedStages = formData.getAll('target_stage').map(String);
  const targetStage = String(submittedStages.at(-1) || '') as ProjectStage;
  const note = String(formData.get('note') || '').trim();
  let destination = `/workspace/projects/${projectId}`;

  if (!projectId || !projectStages.includes(targetStage)) redirect(`${destination}?error=${encodeURIComponent('Invalid project stage request.')}`);

  try {
    const { supabase, user, profile } = await requireUserContext();
    assertRole(profile.role, [...roles]);

    if (targetStage === 'ready_for_execution') {
      const { data: gate, error: gateError } = await supabase.rpc('op_project_financial_gate', { p_project_id: projectId });
      if (gateError) throw new Error(gateError.message);
      if (!gate?.authorised) throw new Error(`Financial mobilisation gate blocked: ${gate?.reason || 'Commercial authorisation is incomplete.'}`);
    }

    const { error } = await supabase.rpc('op_advance_project_stage', { p_project_id: projectId,p_target_stage: targetStage,p_actor_id: user.id,p_note: note || null });
    if (error) throw new Error(error.message);
    refreshProject(projectId);
    destination = `/workspace/projects/${projectId}?advanced=${targetStage}`;
  } catch (error) {
    destination = `/workspace/projects/${projectId}?error=${encodeURIComponent(error instanceof Error ? error.message : 'Project stage could not be advanced.')}`;
  }
  redirect(destination);
}
