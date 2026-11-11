// Second independent synthetic customer: real HTTP -> local PostgREST -> governed SQL.
// Only ephemeral CI: no cloud Supabase, live Stripe, or customer messages.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const endpoint='http://127.0.0.1:3211/api/stripe/webhook', localDb='http://127.0.0.1:54321';
assert.equal(process.env.CI,'true');
assert.equal(process.env.VERCEL_ENV,'local-qa');
assert.equal(process.env.OP_LOCAL_HTTP_QA_ENABLED,'true');
assert.equal(process.env.OP_QA_SUPABASE_PROJECT_REF,'opos_ephemeral_ci');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,localDb);
assert.ok(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_qa_'));
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY);
assert.equal(process.env.OP_STRIPE_FINAL_TEST_ENABLED,'true');
const db=createClient(localDb,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const first={org:'00000000-0000-4000-8000-000000009922',quote:'00000000-0000-4000-8000-000000009924'};
const second={actor:'00000000-0000-4000-8000-000000009931',org:'00000000-0000-4000-8000-000000009932',quote:'00000000-0000-4000-8000-000000009934'};
let checks=0;
function verified(actual,expected,label){
 assert.deepEqual(actual,expected,label);checks++;console.log('PASS second-org: '+label);
}
async function count(table,filters){
 let q=db.from(table).select('*',{count:'exact',head:true});
 for(const [field,val] of Object.entries(filters))q=q.eq(field,val);
 const {count,error}=await q;
 if(error)throw Error('Local '+table+' read error: '+error.message);
 return count;
}
function paymentEvent(id,session,stage='opening',cents=72000,overrides={}){
 return {id,livemode:false,type:'checkout.session.completed',data:{object:{
  object:'checkout.session',id:session,livemode:false,mode:'payment',
  payment_status:'paid',currency:'gbp',amount_total:cents,payment_intent:'pi_qa_'+id,
  metadata:{quote_id:second.quote,organisation_id:second.org,quote_revision:'1',payment_stage:stage,...overrides}
 }}};
}
async function post(event,expected,label){
 const body=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000);
 const signature=createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(timestamp+'.'+body).digest('hex');
 const response=await fetch(endpoint,{method:'POST',signal:AbortSignal.timeout(15000),headers:{
  'content-type':'application/json','stripe-signature':'t='+timestamp+',v1='+signature
 },body});
 const reply=await response.text();
 if(response.status===503 && expected===200 && event.data?.object?.metadata?.payment_stage==='opening'){
  // Local CI only: reveal the actual governed SQL rejection, not secrets.
  const {error:finalizerError}=await db.rpc('op_finalize_verified_stripe_quote_payment',{
   p_session_id:event.data.object.id,
  });
  console.error('SECOND-ORG QA local finalizer diagnostic: '+
   (finalizerError?.message?.slice(0,350)||'direct RPC returned no error')+
   '; HTTP response: '+reply.slice(0,120));
 }
 verified(response.status,expected,label+' (HTTP '+response.status+')');
}
verified(await count('projects',{organisation_id:first.org,quote_id:first.quote}),1,'first customer still has one project');
verified(await count('projects',{organisation_id:second.org,quote_id:second.quote}),0,'second has no project before payment');
verified(await count('quote_payment_confirmations',{organisation_id:second.org,quote_id:second.quote}),0,'no opening receipt for second customer');
await post(paymentEvent('evt_helix_cross_org','cs_helix_cross_org','opening',72000,{organisation_id:first.org}),422,
 'cross-organisation quote metadata rejected');
await post(paymentEvent('evt_helix_underpay','cs_helix_underpay','opening',71900),422,
 '£719 opening payment rejected against frozen £720 deposit');
await post(paymentEvent('evt_helix_wrong_revision','cs_helix_wrong_revision','opening',72000,{quote_revision:'2'}),422,
 'stale quotation revision cannot authorise payment');
const wrongCurrency=paymentEvent('evt_helix_wrong_currency','cs_helix_wrong_currency');
wrongCurrency.data.object.currency='eur';
await post(wrongCurrency,422,'wrong currency cannot authorise GBP project');
await post(paymentEvent('evt_helix_open','cs_helix_open','opening',72000),200,
 'correctly priced £720 opening payment accepted');
verified(await count('projects',{organisation_id:second.org,quote_id:second.quote}),1,
 'paid opening event creates exactly one second-tenant Project 360');
verified(await count('quote_payment_confirmations',{organisation_id:second.org,quote_id:second.quote}),1,
 'one independent verified opening receipt persisted');
verified(await count('projects',{organisation_id:first.org,quote_id:first.quote}),1,
 'original project unchanged after second tenant opening');
verified(await count('quote_stripe_payment_events',{organisation_id:first.org,quote_id:second.quote}),0,
 'cross-tenant payment record never persisted');
await post(paymentEvent('evt_helix_replay','cs_helix_open','opening',72000),200,'second event for same session is idempotent');
await post(paymentEvent('evt_helix_competing','cs_helix_competing','opening',72000),409,'competing opening session blocked');
verified(await count('projects',{organisation_id:second.org,quote_id:second.quote}),1,'replayed opening cannot create second project');
const {data:projects,error}=await db.from('projects').select('id,organisation_id')
 .eq('organisation_id',second.org).eq('quote_id',second.quote);
if(error)throw error;
verified(projects?.length,1,'independent second project is readable');
verified(projects[0].organisation_id,second.org,'project tenant never inherited from first quote');
const projectId=projects[0].id;
const {data:firstProjects,error:firstError}=await db.from('projects').select('id')
 .eq('organisation_id',first.org).eq('quote_id',first.quote);
if(firstError)throw firstError;
verified(firstProjects?.length,1,'other tenant has exactly one real project for foreign-ID test');
await post(paymentEvent('evt_helix_other_project','cs_helix_other_project','final',168000,{project_id:firstProjects[0].id}),422,
 'foreign project ID cannot enable second-tenant final settlement');
await post(paymentEvent('evt_helix_short_final','cs_helix_short_final','final',167900,{project_id:projectId}),422,
 '£1,679 final payment rejected against £1,680 balance');
const final=paymentEvent('evt_helix_final','cs_helix_final','final',168000,{project_id:projectId});
await post(final,503,'paid final event does not settle before client review acceptance');
verified(await count('op_project_final_settlements',{organisation_id:second.org,project_id:projectId}),0,
 'premature final attempt leaves settlement empty');
// Intentionally never fabricate a customer review. The final payment remains
// blocked until the client completes the governed portal action after controlled
// partner delivery and operator QA. This payment-only smoke test MUST NOT pass
// itself off as a complete project lifecycle.
await post(final,503,'replayed final event stays blocked without client acceptance');
verified(await count('op_project_final_settlements',{organisation_id:second.org,project_id:projectId}),0,
 'no final settlement can be manufactured by a replay');
verified(await count('op_project_final_release_approvals',{organisation_id:second.org,project_id:projectId}),0,
 'paid final balance alone never releases editable engineering files');
verified(await count('projects',{organisation_id:first.org,quote_id:first.quote}),1,
 'first organisation remains unchanged throughout');
console.log('SUCCESS: '+checks+' second-organisation payment-boundary checks (NOT a full lifecycle); no persistent QA data.');
