// Real HTTP signed Stripe webhook against disposable local QA, never real money.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
export async function verifyHelixOpeningPayment(admin,orgId,quote,caseId){
 assert.equal(process.env.CI,'true');
 assert.equal(process.env.OP_ISOLATED_QA_BACKEND,'true');
 assert.equal(process.env.OP_LOCAL_HTTP_QA_ENABLED,'true');
 assert.equal(process.env.VERCEL_ENV,'local-qa');
 assert.ok(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_qa_'));
 const {data:terms,error:termsError}=await admin.from('quote_release_contracts')
  .select('release_basis,opening_amount,currency').eq('organisation_id',orgId)
  .eq('quote_id',quote.id).eq('quote_revision',quote.revision).single();
 assert.equal(termsError,null);
 assert.equal(terms.release_basis,'deposit');
 const pennies=Math.round(Number(terms.opening_amount)*100);
 assert.ok(Number.isSafeInteger(pennies)&&pennies>0);
 // This authorises only the disposable test QUOTE for synthetic sandbox
 // webhook verification; it does not insert acceptance, payment or a project.
 const {error:permitError}=await admin.from('op_sandbox_payment_authorisations').insert({
  organisation_id:orgId,quote_id:quote.id,quote_revision:quote.revision,
  expires_at:new Date(Date.now()+3600*1000).toISOString(),
  note:'Disposable CI quote; explicitly authorised signed local test event'
 });
 assert.equal(permitError,null,'Synthetic payment must have explicit QA-only authorisation');
 const event=(id,cents)=>({id,livemode:false,type:'checkout.session.completed',data:{object:{
  object:'checkout.session',id:'cs_'+id,livemode:false,mode:'payment',
  payment_status:'paid',currency:'gbp',amount_total:cents,payment_intent:'pi_'+id,
  metadata:{quote_id:quote.id,organisation_id:orgId,
   quote_revision:String(quote.revision),payment_stage:'opening'}
 }}});
 const post=async(e)=>{
  const body=JSON.stringify(e),timestamp=Math.floor(Date.now()/1000);
  const signature=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET)
   .update(timestamp+'.'+body).digest('hex');
  const reply=await fetch('http://127.0.0.1:3211/api/stripe/webhook',{
   method:'POST',headers:{'content-type':'application/json',
    'stripe-signature':'t='+timestamp+',v1='+signature},
   body,signal:AbortSignal.timeout(25000)});
  return {status:reply.status,body:await reply.text()};
 };
 const under=await post(event('evt_helix_new_quote_underpay',pennies-1));
 assert.equal(under.status,422,'Underpayment cannot release new Helix project: '+under.body);
 const {count:before,error:beforeError}=await admin.from('projects')
  .select('*',{count:'exact',head:true}).eq('organisation_id',orgId).eq('quote_id',quote.id);
 assert.equal(beforeError,null);
 assert.equal(before,0);
 const correct=await post(event('evt_helix_new_quote_opening',pennies));
 assert.equal(correct.status,200,'A correctly authorised opening payment must create the Project 360: '+correct.body);
 const {data:projects,error:projectError}=await admin.from('projects')
  .select('id,lead_id,quote_id,project_stage').eq('organisation_id',orgId).eq('quote_id',quote.id);
 assert.equal(projectError,null);
 assert.equal(projects?.length,1);
 assert.equal(projects[0].lead_id,caseId,'New paid project must follow governed commercial Case lineage');
 assert.equal(projects[0].project_stage,'mobilisation');
 const {data:payments,error:paymentError}=await admin.from('quote_payment_confirmations')
  .select('id').eq('organisation_id',orgId).eq('quote_id',quote.id);
 assert.equal(paymentError,null);
 assert.equal(payments.length,1,'One verified opening payment receipt');
 console.log('PASS browser/HTTP: client-accepted new Case quotation funded by signed local webhook; genuine Project 360 created.');
 return projects[0].id;
}
