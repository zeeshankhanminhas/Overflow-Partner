'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';
import {ensureApprovedPartnerAssignment,releaseApprovedPartnerWorkOrder} from '@/lib/execution/autoWorkOrder';

export async function retryGovernedWorkOrderAction(formData:FormData){
  const projectId=String(formData.get('project_id')||'');
  if(!/^[0-9a-f-]{36}$/i.test(projectId))throw new Error('Invalid project reference.');
  const target='/opos-next/projects/'+encodeURIComponent(projectId)+'/work-order';
  let params='';
  try{
    assertIsolatedQaBackend();
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin']);
    const {data:project,error:projectError}=await supabase.from('projects')
      .select('id,project_stage,quote_id').eq('organisation_id',organisationId).eq('id',projectId).maybeSingle();
    if(projectError||!project)throw new Error('Project could not be verified.');
    if(project.project_stage!=='ready_for_execution')throw new Error('Complete governed Mobilisation before Work Order release.');
    const {data:scopes,error:scopeError}=await supabase.from('documents')
      .select('id').eq('organisation_id',organisationId).eq('project_id',projectId)
      .eq('document_type','statement-of-work').eq('is_current_revision',true)
      .in('status',['approved','issued','published']).order('created_at',{ascending:false}).limit(2);
    if(scopeError||scopes?.length!==1)throw new Error('Exactly one current approved Statement of Work is required.');
    await ensureApprovedPartnerAssignment(supabase,organisationId,user.id,projectId,scopes[0].id);
    const result=await releaseApprovedPartnerWorkOrder(supabase,organisationId,user.id,projectId);
    revalidatePath('/opos-next/projects/'+projectId);
    revalidatePath(target);
    params='success='+encodeURIComponent('Controlled Partner Work Order queued (not yet delivered). Assignment '+result.assignmentId.slice(0,8)+'.');
  }catch(error){
    params='error='+encodeURIComponent(error instanceof Error?error.message:'Work Order release was blocked.');
  }
  redirect(target+'?'+params);
}
