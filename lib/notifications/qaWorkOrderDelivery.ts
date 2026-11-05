import type {SupabaseClient} from '@supabase/supabase-js';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {deliverNotificationEmail,type OutboxRow} from '@/lib/notifications/emailProvider';

export type QaPartnerEmailResult={status:'sent'|'pending';reason?:string};

/**
 * Deliver ONLY the existing Northfield Work Order invitation that the governed
 * server action just queued. Vercel preview does not run production cron jobs.
 * Use an atomic outbox claim and Resend idempotency; never send twice or process
 * unrelated pending notifications.
 */
export async function deliverNorthfieldQaPartnerInvitation(
  db:SupabaseClient,organisationId:string,projectId:string
):Promise<QaPartnerEmailResult>{
  if(!isKnownIsolatedQaBackend() ||
     process.env.OP_QA_EMAIL_SENDING_ENABLED!=='true' ||
     organisationId!=='717262cb-68da-4e7b-a9fa-238dc6c5d16b' ||
     projectId!=='b447f586-bf79-4839-be5e-1af607d9ca43')
    return {status:'pending',reason:'Northfield isolated QA email delivery is not authorised.'};

  const {data:order,error:orderError}=await db.from('partner_work_orders')
    .select('id,assignment_id').eq('organisation_id',organisationId)
    .eq('project_id',projectId).maybeSingle();
  if(orderError||!order?.id)return {status:'pending',reason:'Governed Work Order not yet issued.'};

  const {data:row,error:lookupError}=await db.from('notification_outbox')
    .select('*').eq('organisation_id',organisationId).eq('entity_id',projectId)
    .eq('entity_type','project').eq('event_key','partner_work.released')
    .order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(lookupError||!row?.id)return {status:'pending',reason:'Partner invitation was not queued.'};
  if(!String(row.idempotency_key||'').startsWith('auto:work-order:'+order.assignment_id+':cycle:'))
    return {status:'pending',reason:'Partner invitation does not match the issued assignment.'};
  if(row.status==='sent'&&row.provider_message_id)return {status:'sent'};
  if(!['pending','failed'].includes(String(row.status)) ||
     Number(row.attempts)>=Number(row.max_attempts))
    return {status:'pending',reason:'Invitation is processing or awaiting the existing retry policy.'};

  const now=new Date().toISOString();
  const {data:claimed,error:claimError}=await db.from('notification_outbox')
    .update({status:'processing',locked_at:now,attempts:Number(row.attempts)+1,updated_at:now})
    .eq('organisation_id',organisationId).eq('id',row.id)
    .eq('status',row.status).eq('attempts',row.attempts)
    .is('locked_at',null).lte('scheduled_for',now)
    .select('*').maybeSingle();
  if(claimError)return {status:'pending',reason:'Invitation could not be claimed for provider delivery.'};
  if(!claimed)return {status:'pending',reason:'Another sender has claimed this invitation; no duplicate email sent.'};

  try{
    const providerId=await deliverNotificationEmail(claimed as OutboxRow);
    const {error:finishError}=await db.rpc('op_complete_notification',{
      p_id:claimed.id,p_provider_message_id:providerId,
    });
    if(finishError) return {status:'pending',reason:'Provider accepted the invitation; outbox confirmation needs reconciliation. Do not send again.'};
    const {data:verified,error:verifyError}=await db.from('notification_outbox')
      .select('status,provider_message_id').eq('id',claimed.id)
      .eq('organisation_id',organisationId).maybeSingle();
    if(verifyError||verified?.status!=='sent'||verified.provider_message_id!==providerId)
      return {status:'pending',reason:'Provider accepted the invitation; stored delivery evidence is not yet confirmed.'};
    return {status:'sent'};
  }catch(error){
    const message=error instanceof Error?error.message:'Provider could not accept QA invitation.';
    await db.rpc('op_fail_notification',{p_id:claimed.id,p_error:message});
    return {status:'pending',reason:'The existing QA invitation remains queued for controlled delivery retry.'};
  }
}
