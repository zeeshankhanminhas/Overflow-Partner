'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient as createPrivilegedClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';
import {issueWorkOrderAfterVerifiedOpeningPayment} from '@/lib/execution/paymentWorkOrderHandoff';
import {deliverNorthfieldQaPartnerInvitation} from '@/lib/notifications/qaWorkOrderDelivery';

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
    // The Preview environment has no automatic Vercel Cron invocation.
    // Deliver only the exact newly queued QA partner invitation here, using
    // the same Resend provider and idempotent notification record as the
    // ordinary worker. Work Order issuance remains successful if delivery
    // fails; never reissue an immutable order merely to resend an email.
    let invitationStatus='The partner invitation is queued; delivery has not been confirmed.';
    try{
      const delivery=await deliverNorthfieldQaPartnerInvitation(serviceDb,organisationId,projectId);
      invitationStatus=delivery.status==='sent'
        ?'The partner invitation was accepted by the email provider; formal partner acceptance is still required.'
        :'Partner invitation remains pending. '+String(delivery.reason||'');
    }catch{
      invitationStatus='Partner invitation has not yet been confirmed; check its existing outbox record, not a new Work Order.';
    }
    params='success='+encodeURIComponent('The governed Work Order was issued. '+invitationStatus);
  }catch(error){
    params='error='+encodeURIComponent(error instanceof Error?error.message:'Work Order release was blocked.');
  }
  redirect(target+'?'+params);
}


/**
 * Post-issue QA recovery. This does NOT call the Work Order issuer.
 * It resumes the ONE existing, provider-rejected outbox invitation only.
 */
export async function retryNorthfieldQaInvitationAction(formData:FormData) {
  const projectId=String(formData.get('project_id')||'');
  const target='/opos-next/projects/'+encodeURIComponent(projectId)+'/work-order';
  if(projectId!=='b447f586-bf79-4839-be5e-1af607d9ca43')
    throw new Error('This recovery action is restricted to the existing Northfield QA project.');
  let params='';
  try{
    assertIsolatedQaBackend();
    const {supabase,organisationId,profile,user}=await requireUserContext();
    assertRole(profile.role,['owner','admin']);
    if(organisationId!=='717262cb-68da-4e7b-a9fa-238dc6c5d16b')
      throw new Error('This project does not belong to the isolated Northfield QA workspace.');
    const {data:project,error:projectError}=await supabase.from('projects')
      .select('id,quote_id,project_stage').eq('organisation_id',organisationId)
      .eq('id',projectId).maybeSingle();
    if(projectError||!project||project.quote_id!=='c5b894db-ccdd-47e2-a58a-c38005bcaa99' ||
      !['mobilisation','ready_for_execution'].includes(String(project.project_stage)))
      throw new Error('Northfield project is not in the permitted partner-release stage.');

    const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!serviceKey)throw new Error('Server-only invitation writer is unavailable.');
    const db=createPrivilegedClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:wo,error:woError}=await db.from('partner_work_orders')
      .select('id,assignment_id,status').eq('organisation_id',organisationId)
      .eq('project_id',projectId).maybeSingle();
    if(woError||wo?.status!=='issued'||!wo.assignment_id)
      throw new Error('The original governed Work Order must exist before invitation recovery.');
    const {data:accepted}=await db.from('partner_work_order_acceptances').select('id')
      .eq('organisation_id',organisationId).eq('project_id',projectId).maybeSingle();
    if(accepted?.id)throw new Error('The Work Order is already accepted; no invitation will be resent.');

    const {data:outbox,error:outboxError}=await db.from('notification_outbox')
      .select('id,status,attempts,max_attempts,locked_at,scheduled_for,last_error,provider_message_id,idempotency_key,recipient_email')
      .eq('organisation_id',organisationId).eq('entity_id',projectId)
      .eq('event_key','partner_work.released').order('created_at',{ascending:false})
      .limit(1).maybeSingle();
    if(outboxError||!outbox?.id)throw new Error('The original partner invitation is missing; do not issue a second Work Order.');
    if(!String(outbox.idempotency_key||'').startsWith('auto:work-order:'+wo.assignment_id+':cycle:'))
      throw new Error('Invitation does not match the issued Work Order assignment.');
    if(outbox.status==='sent'&&outbox.provider_message_id){
      params='success='+encodeURIComponent('The existing invitation is already accepted by the provider; no second email was sent.');
    }else {
      if(outbox.status!=='pending'||outbox.locked_at||outbox.provider_message_id||
         Number(outbox.attempts)>=Number(outbox.max_attempts))
        throw new Error('Invitation is being processed or cannot be retried automatically.');
      // Only accelerate the exact previously recorded Resend testing-recipient
      // rejection; do not override ordinary backoff or unrelated provider failures.
      const prior=String(outbox.last_error||'');
      if(prior.includes('You can only send testing emails to your own email address')){
        const {data:updated,error:retryError}=await db.from('notification_outbox')
          .update({scheduled_for:new Date().toISOString(),updated_at:new Date().toISOString()})
          .eq('organisation_id',organisationId).eq('id',outbox.id)
          .eq('status','pending').eq('attempts',outbox.attempts)
          .eq('last_error',outbox.last_error).is('locked_at',null)
          .select('id').maybeSingle();
        if(retryError||!updated)throw new Error('Another handler changed the invitation; refresh before retrying.');
      }
      const delivery=await deliverNorthfieldQaPartnerInvitation(db,organisationId,projectId);
      if(delivery.status==='sent'){
        await db.from('activity_events').insert({
          organisation_id:organisationId,entity_type:'project',entity_id:projectId,
          user_id:user.id,event_type:'qa.original_partner_invitation_delivered',
          event_data:{outboxId:outbox.id,workOrderId:wo.id,originalRecipient:outbox.recipient_email,
            transport:'Resend verified primary test inbox',noAdditionalWorkOrder:true}
        });
      }
      params=delivery.status==='sent'
        ?'success='+encodeURIComponent('The existing Northfield partner invitation was accepted by Resend. Check your primary QA Gmail inbox; partner acceptance is still required.')
        :'error='+encodeURIComponent(delivery.reason||'Provider delivery remains pending.');
    }
    revalidatePath(target);
    revalidatePath('/opos-next/projects/'+projectId);
  }catch(error){
    params='error='+encodeURIComponent(error instanceof Error?error.message:'Partner invitation recovery failed.');
  }
  redirect(target+'?'+params);
}
