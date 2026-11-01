'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { renderNotificationEmail } from '@/lib/notifications/templates';
import { assertQaRecipientAllowed } from '@/lib/qa/email-guard';
import { assertIsolatedQaBackend } from '@/lib/qa/isolation';
import { createClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { qaPublicOrigin } from '@/lib/qa/publicOrigin';

function qaNotificationAdmin() {
  assertIsolatedQaBackend();
  if (process.env.OP_QA_EMAIL_SENDING_ENABLED !== 'true') throw new Error('QA outbound email is not enabled.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('QA notification database configuration is incomplete.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

async function deliverPortalEmail(
  admin: ReturnType<typeof qaNotificationAdmin>,
  organisationId: string, quoteId: string, outboxId: string, authorisedEmail: string,
) {
  const {data:row,error:loadError}=await admin.from('notification_outbox')
    .select('id,status,attempts,organisation_id,entity_id,recipient_email,recipient_name,event_key,category,subject,template_key,payload,provider_message_id')
    .eq('id',outboxId).eq('organisation_id',organisationId).eq('entity_id',quoteId)
    .eq('recipient_email',authorisedEmail).maybeSingle();
  if(loadError || !row)throw new Error(loadError?.message||'Portal email queue record was not found.');
  if(row.status==='sent' && row.provider_message_id)return row.provider_message_id;
  if(!['pending','failed'].includes(row.status))throw new Error('Portal email is currently being processed. Refresh the case before retrying.');
  if(row.event_key!=='quote.issued'||!String(row.subject).startsWith('Secure client portal access'))
    throw new Error('The queued message is not an authorised portal access email.');
  assertQaRecipientAllowed(row.recipient_email);
  const apiKey=process.env.RESEND_API_KEY;
  const from=process.env.RESEND_FROM_EMAIL;
  if(!apiKey || !from)throw new Error('QA Resend sender is not configured.');
  const now=new Date().toISOString();
  const {data:locked,error:lockError}=await admin.from('notification_outbox')
    .update({status:'processing',attempts:Number(row.attempts||0)+1,locked_at:now,updated_at:now,last_error:null})
    .eq('id',outboxId).eq('status',row.status).select('id').maybeSingle();
  if(lockError)throw new Error(lockError.message);
  if(!locked)throw new Error('Another delivery attempt is already handling this email.');
  try {
    const rendered=await renderNotificationEmail({
      event_key:row.event_key,category:row.category,recipient_name:row.recipient_name,
      subject:row.subject,template_key:row.template_key,payload:row.payload||{},
    });
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`overflow-partner-${outboxId}`},
      body:JSON.stringify({
        from,to:[row.recipient_email],subject:row.subject,html:rendered.html,text:rendered.text,
        ...(process.env.RESEND_REPLY_TO_EMAIL?{reply_to:process.env.RESEND_REPLY_TO_EMAIL}:{}),
        headers:{'X-Overflow-Partner-Event':row.event_key,'X-Overflow-Partner-Outbox':row.id},
      }),
    });
    const body=await response.json().catch(()=>({})) as {id?:string;message?:string;name?:string};
    if(!response.ok||!body.id)throw new Error(body.message||body.name||`Resend returned HTTP ${response.status}`);
    const sentAt=new Date().toISOString();
    const {error:completeError}=await admin.from('notification_outbox')
      .update({status:'sent',provider_message_id:body.id,sent_at:sentAt,locked_at:null,last_error:null,updated_at:sentAt})
      .eq('id',outboxId).eq('status','processing');
    if(completeError)throw new Error('Resend accepted the email, but delivery recording failed: '+completeError.message);
    return body.id;
  }catch(error){
    await admin.from('notification_outbox').update({
      status:'failed',locked_at:null,last_error:error instanceof Error?error.message:'Email delivery failed',updated_at:new Date().toISOString(),
    }).eq('id',outboxId).eq('status','processing');
    throw error;
  }
}

export async function sendFreshPortalLink(formData: FormData) {
  const leadId=String(formData.get('lead_id')||'');
  const quoteId=String(formData.get('quote_id')||'');
  const target='/opos-next/cases/'+encodeURIComponent(leadId);
  let result='';
  try {
    const {supabase,organisationId,user,profile}=await requireUserContext();
    assertRole(profile.role,['owner','admin','commercial','business_development']);
    const admin=qaNotificationAdmin();
    const {data:issue,error:issueError}=await supabase.from('quote_issue_records')
      .select('quote_revision,recipient_name,recipient_email,client_response')
      .eq('organisation_id',organisationId).eq('lead_id',leadId).eq('quote_id',quoteId).maybeSingle();
    if(issueError)throw issueError;
    if(!issue?.recipient_email||issue.client_response!=='accepted')throw new Error('Accepted quotation and authorised recipient required.');
    const {data:quote,error:quoteError}=await supabase.from('quotes')
      .select('revision,quote_number,status').eq('organisation_id',organisationId).eq('lead_id',leadId).eq('id',quoteId).maybeSingle();
    if(quoteError)throw quoteError;
    if(!quote||Number(quote.revision)!==Number(issue.quote_revision)||!['issued','accepted'].includes(quote.status))
      throw new Error('Quotation revision mismatch.');
    const origin=qaPublicOrigin();
    const link=new URL('/client-portal',origin);
    link.searchParams.set('token',createClientPortalToken(quoteId,Number(quote.revision)));
    const requestId=String(formData.get('request_id')||'');
    if(!/^[0-9a-f-]{36}$/i.test(requestId))throw new Error('Refresh the case before requesting another link.');
    // Retry an already queued portal email rather than producing duplicate pending messages.
    const {data:pending,error:pendingError}=await admin.from('notification_outbox')
      .select('id,payload').eq('organisation_id',organisationId).eq('entity_id',quoteId)
      .eq('recipient_email',issue.recipient_email).eq('status','pending').eq('attempts',0)
      .like('idempotency_key',`quote:portal-access:${quoteId}:${quote.revision}:%`)
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(pendingError)throw pendingError;
    // A pending email may contain an earlier immutable deployment URL.
    // Update only an unclaimed QA portal message to the current trusted branch alias
    // before provider delivery, while keeping the original outbox ID and audit trail.
    if(pending?.id){
      const payload={
        ...(pending.payload && typeof pending.payload==='object' ? pending.payload : {}),
        heading:'Your secure client portal',
        message:'Your quotation is already accepted. Open the secure portal to continue.',
        actionLabel:'Open secure client portal',
        actionUrl:link.toString(),
        actions:[{label:'Open client portal',url:link.toString()}],
      };
      const {data:refreshed,error:refreshError}=await admin.from('notification_outbox')
        .update({payload,updated_at:new Date().toISOString()})
        .eq('id',pending.id).eq('organisation_id',organisationId).eq('entity_id',quoteId)
        .eq('recipient_email',issue.recipient_email).eq('status','pending').eq('attempts',0)
        .select('id').maybeSingle();
      if(refreshError || !refreshed)throw new Error(refreshError?.message||'The pending email was already claimed. Retry after it completes.');
    }
    const outboxId=pending?.id || await queueLifecycleEmail(supabase,{
      organisationId,scenario:'quote.issued',recipientEmail:issue.recipient_email,
      recipientName:issue.recipient_name||'Client',
      subject:'Secure client portal access · '+quote.quote_number,
      actionUrl:link.toString(),
      payload:{heading:'Your secure client portal',message:'Your quotation is already accepted. Open the secure portal to continue.',actionLabel:'Open secure client portal',actions:[{label:'Open client portal',url:link.toString()}]},
      entityType:'quote',entityId:quoteId,
      idempotencyKey:'quote:portal-access:'+quoteId+':'+quote.revision+':'+requestId,
    });
    if(!outboxId)throw new Error('Email is not enabled for this authorised recipient.');
    const {error:auditError}=await supabase.rpc('op_record_activity',{
      p_organisation_id:organisationId,p_user_id:user.id,p_entity_type:'quote',p_entity_id:quoteId,
      p_event_type:'client_portal_access_requested',p_event_data:{revision:quote.revision,recipientEmail:issue.recipient_email,outboxId},
    });
    if(auditError)throw new Error('Portal email audit recording failed: '+auditError.message);
    const providerId=await deliverPortalEmail(admin,organisationId,quoteId,outboxId,issue.recipient_email);
    revalidatePath(target);
    result=`Portal email accepted by Resend for ${issue.recipient_email} (delivery reference: ${providerId}). Check your inbox.`;
  }catch(e){result='Unable to send portal link: '+(e instanceof Error?e.message:'Unexpected error');}
  redirect(target+'?'+(result.startsWith('Unable')?'error=':'success=')+encodeURIComponent(result));
}
