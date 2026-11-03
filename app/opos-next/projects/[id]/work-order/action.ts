'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient as createPrivilegedClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';
import {issueWorkOrderAfterVerifiedOpeningPayment} from '@/lib/execution/paymentWorkOrderHandoff';

export async function retryGovernedWorkOrderAction(formData:FormData){
  const projectId=String(formData.get('project_id')||'');
  if(!/^[0-9a-f-]{36}$/i.test(projectId))throw new Error('Invalid project reference.');
  const target='/opos-next/projects/'+encodeURIComponent(projectId)+'/work-order';
  let params='';
  try{
    assertIsolatedQaBackend();
    // Authentication/role are always established using the real signed-in
    // operator. The resulting controlled WO tables are intentionally
    // service-role WRITE ONLY (users have SELECT access). Never grant
    // browser users write permissions as a way around this control.
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin']);
    const {data:targetProject,error:targetError}=await supabase.from('projects')
      .select('id,organisation_id,project_stage,quote_id')
      .eq('organisation_id',organisationId).eq('id',projectId).maybeSingle();
    if(targetError||!targetProject?.id||!targetProject.quote_id)
      throw new Error('The requested project is not available to your organisation.');
    if(!['mobilisation','ready_for_execution'].includes(String(targetProject.project_stage)))
      throw new Error('Work Orders must be issued before execution begins.');

    // Privileged writes happen ONLY after authenticated ownership, role,
    // organisation and project checks, and only against the isolated QA
    // backend. Do not inherit the browser user JWT in this separate client.
    const apiUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!apiUrl||!serviceKey)throw new Error('Server-only Work Order writer is not configured.');
    const serviceDb=createPrivilegedClient(apiUrl,serviceKey,{
      auth:{persistSession:false,autoRefreshToken:false},
    });
    const result=await issueWorkOrderAfterVerifiedOpeningPayment(serviceDb,organisationId,projectId);
    if(result.status!=='queued')throw new Error(result.reason||'Work Order issuance remains blocked by missing governed evidence.');
    // Keep an attributed operator audit record without disclosing the
    // internal service key or any client/partner portal token.
    const {error:auditError}=await serviceDb.from('activity_events').insert({
      organisation_id:organisationId,entity_type:'project',entity_id:projectId,
      user_id:user.id,event_type:'qa.partner_work_order_operator_requested',
      event_data:{executionMode:'isolated_qa',issuedByRole:String(profile.role),
        assignmentId:result.assignmentId||null},
    });
    if(auditError)throw new Error('Work Order issued, but operator audit could not be recorded. Refresh and inspect the current Work Order; do not issue another.');

    revalidatePath('/opos-next/projects/'+projectId);
    revalidatePath(target);
    params='success='+encodeURIComponent('The original payment-triggered Work Order handoff was retried; partner notification is queued, not yet proven delivered.');
  }catch(error){
    params='error='+encodeURIComponent(error instanceof Error?error.message:'Work Order release was blocked.');
  }
  redirect(target+'?'+params);
}
