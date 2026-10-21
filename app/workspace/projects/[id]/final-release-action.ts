import { assertIsolatedQaBackend } from '@/lib/qa/isolation';
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { createClientPortalToken } from '@/lib/quotes/clientPortalToken';

export async function approveFinalEngineeringReleaseAction(formData:FormData) {
  const projectId=String(formData.get('project_id')||'').trim();
  let destination='/workspace/projects/'+projectId;
  try {
    if(!/^[0-9a-f-]{36}$/i.test(projectId))throw new Error('Valid Project 360 is required.');
    if(process.env.OP_VOICE_FINAL_RELEASE_ENABLED!=='true')
      throw new Error('The governed final-release gate is not enabled yet.');
    if(process.env.VERCEL_ENV==='preview'&&process.env.OP_ISOLATED_QA_BACKEND!=='true')
      throw new Error('Preview cannot release final files against the shared production database.');
    if(process.env.VERCEL_ENV==='preview')assertIsolatedQaBackend();
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,['owner','admin']);
    const note=String(formData.get('approval_note')||'').trim();
    // The RPC verifies owner identity, client review acceptance, 100% receipt,
    // current partner technical QC and the controlled handover-pack revision.
    const {data:approval,error:approvalError}=await supabase.rpc('op_approve_project_final_release',{
      p_organisation_id:organisationId,p_user_id:user.id,p_project_id:projectId,p_note:note||null,
    });
    if(approvalError||!approval?.project_id)throw new Error(approvalError?.message||'Final approval could not be recorded.');
    const {data:project,error:projectError}=await supabase.from('projects').select('id,quote_id,project_number')
      .eq('organisation_id',organisationId).eq('id',projectId).single();
    if(projectError||!project?.quote_id)throw new Error('Project quotation could not be loaded for client delivery.');
    const {data:quote}=await supabase.from('quotes').select('id,revision')
      .eq('organisation_id',organisationId).eq('id',project.quote_id).single();
    if(!quote)throw new Error('Accepted quotation revision is not available.');
    const {data:issued}=await supabase.from('quote_issue_records').select('recipient_name,recipient_email,client_response')
      .eq('organisation_id',organisationId).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
    if(issued?.client_response!=='accepted'||!issued.recipient_email)
      throw new Error('Authorised client contact is unavailable for final handover notification.');
    const host=process.env.VERCEL_ENV==='preview' && process.env.VERCEL_URL
      ? 'https://'+process.env.VERCEL_URL
      : (process.env.NEXT_PUBLIC_SITE_URL||'https://overflow-partner.vercel.app').replace(/\/$/,'');
    const url=host+'/client-final-files?token='+encodeURIComponent(createClientPortalToken(quote.id,quote.revision));
    const outboxId=await queueLifecycleEmail(supabase,{
      organisationId,scenario:'client_delivery.final_released',recipientEmail:issued.recipient_email,
      recipientName:issued.recipient_name||undefined,actionUrl:url,
      entityType:'project',entityId:projectId,
      payload:{reference:project.project_number,projectReference:project.project_number},
      idempotencyKey:'client:final-release:'+projectId,
    });
    if(!outboxId)throw new Error('Final approval saved but client email is suppressed. Review notification preferences.');
    revalidatePath(destination);
    destination+='?updated='+encodeURIComponent('Final engineering release approved and secure client notification queued.')+'&focus=record-next-action';
  } catch(error) {
    destination+='?error='+encodeURIComponent(error instanceof Error?error.message:'Final release could not be completed.')+'&focus=record-next-action';
  }
  redirect(destination);
}
