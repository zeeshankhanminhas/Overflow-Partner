'use server';

import { assertIsolatedQaBackend } from '@/lib/qa/isolation';

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
    // Release approval is a durable governed decision. A QA email allowlist
    // failure must NEVER be misreported as a failed final-release approval.
    let notice='Final engineering release approved. Client notification was not queued; check the outbox. The entitled Client Workspace can independently open final files.';
    try{
      const outboxId=await queueLifecycleEmail(supabase,{
        organisationId,scenario:'client_delivery.final_released',recipientEmail:issued.recipient_email,
        recipientName:issued.recipient_name||undefined,actionUrl:url,
        entityType:'project',entityId:projectId,
        payload:{reference:project.project_number,projectReference:project.project_number},
        idempotencyKey:'client:final-release:'+projectId,
      });
      if(outboxId)notice='Final engineering release approved. Secure client notification queued; delivery is not yet confirmed.';
    }catch{
      // Do not bypass QA recipient allowlists, send to unknown recipients,
      // or roll back an owner approval that is already committed.
      if(process.env.VERCEL_ENV==='preview')
        notice='Final engineering release approved. QA email blocked by the isolated recipient allowlist; no client notification was sent. Sign in to the entitled Client Workspace to test final-file access.';
    }
    revalidatePath(destination);
    destination+='?updated='+encodeURIComponent(notice)+'&focus=record-next-action';
  } catch(error) {
    destination+='?error='+encodeURIComponent(error instanceof Error?error.message:'Final release could not be completed.')+'&focus=record-next-action';
  }
  if(formData.get('opos_next')==='1')destination=destination.replace(/^\/workspace\/projects\//,'/opos-next/projects/');
  revalidatePath('/opos-next/projects/'+projectId);
  redirect(destination);
}
