'use server';

import { createHash, randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { isKnownIsolatedQaStep2Backend } from '@/lib/qa/isolation';
import { qaAllowedRecipientAddresses } from '@/lib/qa/email-guard';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { recordActivity } from '@/lib/repositories/activity';
import { deliverOneQaStep2Invitation } from '@/lib/qa/send-step2-invitation';

const qaOrg = '717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pathFor=(id:string)=>'/opos-next/opportunities/'+id;
export async function createQaStep2InvitationAction(formData:FormData) {
  const id=String(formData.get('prospect_id')||'').trim();
  if(!uuid.test(id))redirect('/opos-next/opportunities?error=Invalid%20QA%20opportunity');
  let message=''; let success=false;
  try {
    if(!isKnownIsolatedQaStep2Backend())
      throw new Error('QA Step 2 is not enabled. No invitation has been sent.');
    const {supabase,user,profile,organisationId}=await requireUserContext('/opos-next');
    assertRole(profile.role,['admin','owner','operator']);
    if(organisationId!==qaOrg) throw new Error('QA-only organisation required.');
    const {data:prospect,error:prospectError}=await supabase.from('prospects')
      .select('id,company_name,contact_name,email,status,source,converted_lead_id')
      .eq('organisation_id',organisationId).eq('id',id).single();
    if(prospectError || !prospect || !String(prospect.company_name).startsWith('QA - ') ||
       prospect.source!=='manual' || prospect.converted_lead_id ||
       !['identified','contacted','conversation'].includes(prospect.status)) {
      throw new Error('Only an active fictional QA opportunity can issue a test invitation.');
    }
    const recipient=String(prospect.email||'').trim().toLowerCase();
    if(!recipient.endsWith('+client@gmail.com') || !qaAllowedRecipientAddresses().has(recipient))
      throw new Error('QA invitation requires the exact allowlisted client test alias.');
    const {data:existing,error:existingError}=await supabase.from('intake_sessions')
      .select('id,status').eq('organisation_id',qaOrg).eq('prospect_id',id)
      .not('status','in','(expired,cancelled)').limit(1).maybeSingle();
    if(existingError)throw new Error(existingError.message);
    if(existing)throw new Error('An active or completed QA requirements session already exists. No duplicate invitation was created.');

    const rawToken=randomBytes(32).toString('hex');
    const hash=createHash('sha256').update(rawToken).digest('hex');
    const expiresAt=new Date(Date.now()+7*24*60*60*1000).toISOString();
    const host=String(process.env.VERCEL_URL||'');
    if(!/^overflow-partner-[a-z0-9-]+\.vercel\.app$/i.test(host))
      throw new Error('QA preview host cannot be verified.');
    const actionUrl='https://'+host+'/intake/'+rawToken;
    const {data:session,error:sessionError}=await supabase.from('intake_sessions')
      .insert({organisation_id:qaOrg,prospect_id:id,created_by:user.id,
        token_hash:hash,expires_at:expiresAt,status:'invited',
        recipient_email:recipient,email_status:'pending'}).select('id').single();
    if(sessionError||!session)throw new Error('Could not create QA intake session: '+(sessionError?.message||'Unknown'));
    const payload={company:prospect.company_name,dueDate:new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date(expiresAt))};
    try {
      const outboxId=await queueLifecycleEmail(supabase,{
        organisationId:qaOrg,scenario:'requirements.requested',recipientEmail:recipient,
        recipientName:prospect.contact_name,actionUrl,payload,entityType:'prospect',entityId:id,
        idempotencyKey:'qa:intake:invite:'+session.id,
        subject:'[OPOS QA TEST] Please complete your engineering requirements',
      });
      if(!outboxId)throw new Error('Invitation was not accepted into QA outbox.');
      for(const [hours,subject] of [[24,'Your secure requirements form is still open'],[72,'Reminder: technical details outstanding']] as const){
        await queueLifecycleEmail(supabase,{
          organisationId:qaOrg,scenario:'requirements.reminder',recipientEmail:recipient,
          recipientName:prospect.contact_name,actionUrl,payload,entityType:'prospect',entityId:id,
          scheduledFor:new Date(Date.now()+hours*3600000).toISOString(),
          idempotencyKey:'qa:intake:reminder:'+hours+':'+session.id,subject,
        });
      }
      const {error:updateError}=await supabase.from('intake_sessions')
        .update({email_status:'queued'}).eq('organisation_id',qaOrg).eq('id',session.id);
      if(updateError)throw new Error(updateError.message);
      const {error:prospectUpdateError}=await supabase.from('prospects')
        .update({next_action:'Await QA client technical requirements submission'})
        .eq('organisation_id',qaOrg).eq('id',id);
      if(prospectUpdateError)throw new Error(prospectUpdateError.message);
      await recordActivity(supabase,{organisationId:qaOrg,userId:user.id,
        entityType:'prospect',entityId:id,eventType:'qa.step2_invitation_queued',
        eventData:{synthetic:true,intakeSessionId:session.id,notificationId:outboxId,
          delivery:'queued_not_sent',recipientAlias:'client'}});
      // Optional separate QA-only sender. This does not enable any commercial,
      // partner, payment, or scheduled worker actions.
      const delivery=await deliverOneQaStep2Invitation({
        outboxId:String(outboxId),sessionId:session.id,prospectId:id,
      });
      if(delivery==='sent'){
        await recordActivity(supabase,{organisationId:qaOrg,userId:user.id,
          entityType:'prospect',entityId:id,eventType:'qa.step2_invitation_provider_accepted',
          eventData:{synthetic:true,intakeSessionId:session.id,recipientAlias:'client'}}).catch(()=>undefined);
      }
    } catch(queueError) {
      await supabase.from('intake_sessions')
        .update({email_status:'failed',email_error:'QA notification queue failed'})
        .eq('organisation_id',qaOrg).eq('id',session.id);
      throw queueError;
    }
    success=true;
  } catch(error){message=error instanceof Error?error.message:'Could not queue QA invitation.';}
  revalidatePath(pathFor(id));revalidatePath('/opos-next/opportunities');
  redirect(pathFor(id)+(success?'?qaInvitationQueued=1':'?error='+encodeURIComponent(message.slice(0,400))));
}
