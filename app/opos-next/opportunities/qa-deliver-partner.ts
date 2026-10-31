'use server';
import {createHash,randomBytes} from 'crypto';
import {createClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import {qaAllowedRecipientAddresses} from '@/lib/qa/email-guard';
import {revalidatePath} from 'next/cache';

const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const PROSPECT='dcaad06e-853d-466a-af5a-08b7ae7cc24d';
const REQUEST='e8d6be99-5b5a-446b-a071-cc5c05a102c7';
const PARTNER='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa';
const path='/opos-next/opportunities/'+PROSPECT;
type Result={ok:boolean;message:string};
export async function deliverNorthfieldPartnerInvitation(_previous:Result,formData:FormData):Promise<Result>{
 try{
  if(!isKnownIsolatedQaStep2Backend()||process.env.VERCEL_ENV!=='preview'||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ukcamenuxhdznxaxpyis.supabase.co'||
   process.env.OP_QA_EMAIL_SENDING_ENABLED!=='true') throw Error('Verified isolated QA email sending is not enabled.');
  const {profile,organisationId}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  if(organisationId!==ORG||formData.get('request_id')!==REQUEST||formData.get('confirm')!=='yes')throw Error('QA review confirmation missing.');
  const allowed=[...qaAllowedRecipientAddresses()];
  if(!allowed.includes('opos.qa.testing+partner@gmail.com'))throw Error('QA fictional partner alias is not allowlisted.');
  const to=String(process.env.OP_QA_RESEND_SANDBOX_RECIPIENT||'').toLowerCase();
  if(!/^[a-z0-9._%-]+@gmail\.com$/.test(to)||to.includes('+'))throw Error('Resend sandbox address is invalid.');
  const key=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key||!from||!secret)throw Error('QA-only email provider or database credentials missing.');
  const host=String(process.env.VERCEL_URL||'');
  if(!/^overflow-partner-[a-z0-9-]+\.vercel\.app$/i.test(host))throw Error('Unverified preview hostname.');
  const db=createClient('https://ukcamenuxhdznxaxpyis.supabase.co',secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:review,error}=await db.from('partner_review_requests')
    .select('id,status,sent_at,first_opened_at,partner_id,prospect_id,organisation_id')
    .eq('id',REQUEST).eq('organisation_id',ORG).eq('prospect_id',PROSPECT).eq('partner_id',PARTNER).single();
  if(error||!review||review.status!=='invited'||review.sent_at||review.first_opened_at)
   throw Error('This QA review is already delivered, opened or in an unexpected state.');
  const {data:partner}=await db.from('partners').select('status,nda_signed,email').eq('id',PARTNER).eq('organisation_id',ORG).single();
  if(!partner||partner.status!=='prospective'||partner.nda_signed||partner.email!=='opos.qa.testing+partner@gmail.com')
   throw Error('Fictional partner safety condition failed.');
  const {data:prior}=await db.from('notification_outbox').select('id,status')
   .eq('organisation_id',ORG).eq('entity_id',PROSPECT)
   .eq('idempotency_key','qa:northfield:partner-invitation:'+REQUEST).maybeSingle();
  if(prior)throw Error('An invitation already has an outbox record. Do not send a duplicate.');
  const token=randomBytes(32).toString('hex'),digest=createHash('sha256').update(token).digest('hex');
  const link='https://'+host+'/partner-review/'+token;
  const {error:insertError}=await db.from('notification_outbox').insert({
   organisation_id:ORG,event_key:'partner_review.requested',category:'transactional',
   entity_type:'prospect',entity_id:PROSPECT,idempotency_key:'qa:northfield:partner-invitation:'+REQUEST,
   recipient_email:partner.email,subject:'[OPOS QA TEST] Northfield partner technical assessment',
   template_key:'secure_action',payload:{scenario:'partner_review.requested',actionUrl:link,synthetic:true},
   status:'processing',attempts:1,locked_at:new Date().toISOString()
  });
  if(insertError)throw Error('Unable to reserve one-time QA email delivery: '+insertError.message);
  // Activate the token only after the send has a durable idempotency record.
  const {error:tokenError}=await db.from('partner_review_requests').update({token_hash:digest,updated_at:new Date().toISOString()})
   .eq('id',REQUEST).eq('organisation_id',ORG).eq('status','invited').is('sent_at',null);
  if(tokenError)throw Error('Unable to activate partner review link: '+tokenError.message);
  const html='<p><strong>OPOS fictional QA assessment</strong></p><p>Northfield engineering scope, technical files and pricing assessment are ready for review.</p><p><a href="'+link+'">Open secure QA assessment</a></p><p>Simulation only. No legal NDA or real partner approval is implied.</p>';
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
   Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'opos-qa-northfield-'+REQUEST
  },body:JSON.stringify({from,to:[to],subject:'[OPOS QA TEST] Northfield technical assessment',html,
   text:'OPOS fictional QA assessment. Open: '+link+'\nSimulation only.'}),signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>({})) as {id?:string;message?:string};
  const {data:row}=await db.from('notification_outbox').select('id').eq('organisation_id',ORG)
   .eq('idempotency_key','qa:northfield:partner-invitation:'+REQUEST).single();
  if(!response.ok||!body.id){
   if(row)await db.from('notification_outbox').update({status:'failed',last_error:'QA provider rejected send; manual review required.',locked_at:null}).eq('id',row.id);
   throw Error(body.message||'Email provider did not accept the invitation.');
  }
  const now=new Date().toISOString();
  if(row)await db.from('notification_outbox').update({status:'sent',sent_at:now,provider_message_id:body.id,locked_at:null})
    .eq('id',row.id);
  const {error:markError}=await db.from('partner_review_requests').update({sent_at:now,updated_at:now})
   .eq('id',REQUEST).eq('organisation_id',ORG);
  if(markError)throw Error('Provider accepted email but review delivery record needs reconciliation.');
  revalidatePath(path);
  return {ok:true,message:'Resend accepted the fictional QA partner invitation. Provider acceptance does not prove inbox delivery.'};
 }catch(e){return {ok:false,message:e instanceof Error?e.message:'QA delivery failed.'};}
}
