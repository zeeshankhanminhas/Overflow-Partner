/**
 * One-shot, authenticated QA-only Step 2 invitation sender.
 * NEVER reused for production. Strict recipient, business record, and outbox checks.
 * The normal OPOS notification worker remains disabled.
 */
import {createClient} from '@supabase/supabase-js';
import {renderNotificationEmail} from '@/lib/notifications/templates';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import {qaAllowedRecipientAddresses} from '@/lib/qa/email-guard';

const QA_ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';

export async function deliverOneQaStep2Invitation({outboxId,sessionId,prospectId}:{
  outboxId:string;sessionId:string;prospectId:string;
}):Promise<'sent'|'queued'> {
  // The QA invitation can safely be queued even when email delivery is disabled.
  if(process.env.OP_QA_EMAIL_SENDING_ENABLED!=='true')return 'queued';
  if(!isKnownIsolatedQaStep2Backend())throw new Error('QA email sender is locked.');
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(base!=='https://ukcamenuxhdznxaxpyis.supabase.co'||!secret)
    throw new Error('QA-only Supabase server credentials are missing.');
  const allowed=[...qaAllowedRecipientAddresses()].find(x=>x.endsWith('+client@gmail.com'));
  // Resend unverified-domain sandbox only permits the account's verified Gmail.
  // Keep the fictional prospect and session alias unchanged; QA delivery is
  // redirected exclusively to the same allowlisted mailbox's base address.
  const qaDeliveryAddress=String(process.env.OP_QA_TEST_INBOX||'').trim().toLowerCase();
  if(!qaAllowedRecipientAddresses().has(qaDeliveryAddress)||qaDeliveryAddress!== 'zeeshan.khan.minhas@gmail.com')
    throw new Error('QA sandbox recipient is not the verified Resend account inbox.');
  if(!allowed)throw new Error('QA client inbox is not configured.');
  const db=createClient(base,secret,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:prospect,error:prospectError}=await db.from('prospects')
    .select('id,company_name,email').eq('organisation_id',QA_ORG).eq('id',prospectId).single();
  if(prospectError||!prospect||!String(prospect.company_name).startsWith('QA - ')||
     String(prospect.email||'').toLowerCase()!==allowed)
    throw new Error('QA recipient or fictional opportunity cannot be verified.');
  const {data:session,error:sessionError}=await db.from('intake_sessions')
    .select('id,status,prospect_id,recipient_email').eq('organisation_id',QA_ORG).eq('id',sessionId).single();
  if(sessionError||!session||session.prospect_id!==prospectId||
     session.status!=='invited'||String(session.recipient_email).toLowerCase()!==allowed)
    throw new Error('QA invitation session is invalid.');
  const {data:claimed,error:claimError}=await db.from('notification_outbox')
    .update({status:'processing',locked_at:new Date().toISOString(),attempts:2})
    .eq('id',outboxId).eq('organisation_id',QA_ORG)
    .eq('event_key','requirements.requested').eq('entity_type','prospect')
    .eq('idempotency_key','qa:intake:invite:'+sessionId)
    .eq('entity_id',prospectId).eq('status','pending').eq('attempts',1)
    .eq('recipient_email',allowed)
    .select('id,event_key,category,recipient_email,recipient_name,subject,template_key,payload')
    .maybeSingle();
  if(claimError||!claimed)throw new Error('QA invitation was already processed or the outbox row is invalid.');
  try {
    if(claimed.template_key!=='secure_action'||claimed.payload?.scenario!=='requirements.requested'||
       !String(claimed.payload?.actionUrl||'').match(/^https:\/\/overflow-partner-[a-z0-9-]+\.vercel\.app\/intake\/[a-f0-9]{64}$/i))
      throw new Error('QA secure invitation template or link validation failed.');
    const key=process.env.RESEND_API_KEY;
    const from=process.env.RESEND_FROM_EMAIL;
    if(!key||!from)throw new Error('Email provider credentials are not configured.');
    const {html,text}=await renderNotificationEmail(claimed);
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',
        'Idempotency-Key':'overflow-partner-'+outboxId},
      body:JSON.stringify({
        from,to:[qaDeliveryAddress],subject:claimed.subject,html,text,
        headers:{'X-Overflow-Partner-Event':'requirements.requested',
          'X-Overflow-Partner-Outbox':outboxId,'X-OPOS-QA':'true'},
      }),
      signal:AbortSignal.timeout(15000),
    });
    const result=await response.json().catch(()=>({})) as {id?:string;message?:string};
    if(!response.ok||!result.id)throw new Error(result.message||'QA email provider rejected the invitation.');
    const sentAt=new Date().toISOString();
    const {error:completeError}=await db.from('notification_outbox')
      .update({status:'sent',provider_message_id:result.id,locked_at:null,last_error:null,
        sent_at:sentAt,updated_at:sentAt}).eq('organisation_id',QA_ORG).eq('id',outboxId);
    if(completeError)throw new Error('Email accepted, but QA delivery status update failed.');
    const {error:updateError}=await db.from('intake_sessions')
      .update({email_status:'sent',email_message_id:result.id,last_email_attempt_at:sentAt})
      .eq('organisation_id',QA_ORG).eq('id',sessionId);
    if(updateError)throw new Error('Email accepted, but QA intake delivery record update failed.');
    return 'sent';
  }catch(error){
    await db.from('notification_outbox')
      .update({status:'failed',locked_at:null,
        last_error:'QA delivery failed; requires manual review before retry.',
        updated_at:new Date().toISOString()})
      .eq('organisation_id',QA_ORG).eq('id',outboxId).eq('status','processing');
    await db.from('intake_sessions')
      .update({email_status:'failed',email_error:'QA delivery requires review.'})
      .eq('organisation_id',QA_ORG).eq('id',sessionId);
    throw error;
  }
}
