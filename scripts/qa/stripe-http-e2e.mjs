// Real HTTP → Next route → local Supabase PostgREST → governed SQL finalizer.
// No live Stripe network call, cloud Supabase, production keys or customer messages.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const BASE='http://127.0.0.1:3211';
const path=BASE+'/api/stripe/webhook';
const SUPABASE_URL='http://127.0.0.1:54321';
const { CI, VERCEL_ENV, OP_LOCAL_HTTP_QA_ENABLED, OP_QA_SUPABASE_PROJECT_REF,
  NEXT_PUBLIC_SUPABASE_URL, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY }=process.env;

assert.equal(CI,'true','Only trusted ephemeral CI may run the payment HTTP harness');
assert.equal(VERCEL_ENV,'local-qa');
assert.equal(OP_LOCAL_HTTP_QA_ENABLED,'true');
assert.equal(OP_QA_SUPABASE_PROJECT_REF,'opos_ephemeral_ci');
assert.equal(NEXT_PUBLIC_SUPABASE_URL,SUPABASE_URL,'Refuse a non-loopback Supabase endpoint');
assert.ok(STRIPE_WEBHOOK_SECRET?.startsWith('whsec_qa_'),'Use a synthetic test-only webhook signing secret');
assert.ok(SUPABASE_SERVICE_ROLE_KEY,'Disposable CI Supabase key required');

const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,
  {auth:{autoRefreshToken:false,persistSession:false}});
const org='00000000-0000-4000-8000-000000009922';
const quote='00000000-0000-4000-8000-000000009924';
let tests=0;
const equal=(actual,expected,description)=>{
  assert.deepEqual(actual,expected,description);
  tests++;
  console.log('PASS '+description);
};

async function count(table, filters={quote_id:quote}){
  let query=db.from(table).select('*',{count:'exact',head:true});
  for(const [field,value] of Object.entries(filters))query=query.eq(field,value);
  const {count,error}=await query;
  if(error)throw new Error('Read '+table+': '+error.message);
  return count;
}

const event=(id,sessionId,stage='opening',amount=30000,extra={})=>({
  id,livemode:false,type:'checkout.session.completed',
  data:{object:{object:'checkout.session',id:sessionId,livemode:false,mode:'payment',
    payment_status:'paid',currency:'gbp',amount_total:amount,
    payment_intent:'pi_qa_'+id,
    metadata:{quote_id:quote,organisation_id:org,quote_revision:'1',
      payment_stage:stage,...extra}}}
});
function sign(body,secret=STRIPE_WEBHOOK_SECRET,at=Math.floor(Date.now()/1000)){
  return 't='+at+',v1='+createHmac('sha256',secret).update(at+'.'+body).digest('hex');
}
async function post(payload,{unsigned=false,secret,bodyOverride,at}={}){
  const body=bodyOverride??JSON.stringify(payload);
  const response=await fetch(path,{method:'POST',
    headers:{'content-type':'application/json',
      ...(unsigned?{}:{'stripe-signature':sign(JSON.stringify(payload),secret,at)})},
    body,signal:AbortSignal.timeout(15000)});
  const reply=await response.text();
  return {status:response.status,reply};
}
async function expectStatus(payload,status,label,options){
  const result=await post(payload,options);
  equal(result.status,status,label+' ('+result.reply.slice(0,90)+')');
  return result;
}

function recordClientReview(){
  const sql=`begin;
    alter table public.project_client_reviews disable trigger user;
    insert into public.project_client_reviews(
      organisation_id,project_id,outcome,evidence_basis,evidence_reference,recorded_by)
    select organisation_id,id,'accepted','client_portal','QA-HTTP-REVIEW-ACCEPTED',
      '00000000-0000-4000-8000-000000009921'
    from public.projects where quote_id='${quote}';
    alter table public.project_client_reviews enable trigger user;
  commit;`;
  execFileSync('docker',
    ['exec','-i','supabase_db_opos_ephemeral_ci','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
    {input:sql,stdio:['pipe','pipe','pipe'],timeout:20000});
}

for(let i=0;i<80;i++){
  try {
    const health=await fetch(path,{signal:AbortSignal.timeout(1500)});
    if(health.status===405||health.status===503||health.status===400)break;
  } catch {}
  if(i===79)throw new Error('Next webhook route was not ready within 80 seconds');
  await new Promise(resolve=>setTimeout(resolve,1000));
}

// First assert the actual HTTP parser and HMAC guard, before DB writes.
const opening=event('evt_http_open','cs_http_open');
await expectStatus(opening,400,'Missing Stripe signature rejected',{unsigned:true});
await expectStatus(opening,400,'Wrong Stripe secret rejected',{secret:'whsec_qa_wrong'});
await expectStatus(opening,400,'Tampered body rejected',{bodyOverride:JSON.stringify(opening)+' '});
await expectStatus(opening,400,'Expired signed delivery rejected',{at:Math.floor(Date.now()/1000)-310});
await expectStatus({...opening,livemode:true},400,'Stripe live-mode event rejected');
await expectStatus({...opening,type:'customer.created'},200,'Signed unrelated event ignored');

await expectStatus(event('evt_http_underpay','cs_http_underpay','opening',29900),
  422,'£299 underpayment rejected');
equal(await count('projects'),0,'No project before verified £300 opening payment');
equal(await count('quote_stripe_payment_events'),0,'Invalid events do not become trusted paid evidence');
await expectStatus(event('evt_http_wrong_revision','cs_http_wrong_revision','opening',30000,{quote_revision:'2'}),
  422,'Wrong accepted quotation revision rejected');
await expectStatus(event('evt_http_wrong_currency','cs_http_wrong_currency','opening',30000),
  200,'Normal correctly priced GBP event accepted on first full HTTP round trip');
// The preceding valid event intentionally establishes the one successful opening payment.
equal(await count('projects'),1,'Verified signed £300 Checkout creates exactly one Project 360');
equal(await count('quote_payment_confirmations'),1,'Opening payment independently recorded once');
equal(await count('quote_stripe_payment_events'),1,'Exactly one opening paid event persisted');
{
 const {data,error}=await db.from('quote_payment_confirmations')
 .select('amount,payment_reference').eq('quote_id',quote).single();
 if(error)throw error;
 equal(Number(data.amount),300,'Opening amount frozen at £300, not full £1,000');
 equal(data.payment_reference,'cs_http_wrong_currency','Opening receipt tied to exact verified Checkout session');
}

const sameOpening=event('evt_http_wrong_currency','cs_http_wrong_currency');
await expectStatus(sameOpening,200,'Same signed Stripe delivery replays safely');
await expectStatus(event('evt_http_rotated','cs_http_wrong_currency'),200,
 'Separate event ID for same signed session is idempotent');
equal(await count('projects'),1,'Two replay variants still produce one project');
equal(await count('quote_payment_confirmations'),1,'Replays do not produce duplicate opening receipts');
await expectStatus(event('evt_http_second_open','cs_http_second_open'),409,
 'Competing paid opening session rejected for reconciliation');
equal(await count('quote_stripe_payment_events'),1,'Competing second session is not recorded as another payment');

const {data:projects,error:projectError}=await db.from('projects')
  .select('id').eq('quote_id',quote).single();
if(projectError)throw projectError;
const projectId=projects.id;
const finalExtra={project_id:projectId};
await expectStatus(event('evt_http_short_final','cs_http_short_final','final',69900,finalExtra),
  422,'£699 final underpayment rejected');
equal(await count('op_project_final_settlements',{project_id:projectId}),0,
 'No final settlement from insufficient funds');

// A paid final Stripe event is verified but cannot settle until client review is accepted.
// This must return a retryable response; the same verified delivery later succeeds.
const final=event('evt_http_final','cs_http_final','final',70000,finalExtra);
await expectStatus(final,503,'Final payment cannot settle before client review acceptance');
equal(await count('op_project_final_settlements',{project_id:projectId}),0,
  'Premature final webhook creates no settlement');
recordClientReview();
await expectStatus(final,200,'After client acceptance the exact signed £700 event reconciles');
equal(await count('op_project_final_settlements',{project_id:projectId}),1,
  'Exactly one settled £700 final balance');
await expectStatus(final,200,'Final payment webhook retry is idempotent');
await expectStatus(event('evt_http_second_final','cs_http_second_final','final',70000,finalExtra),
 409,'Competing final paid session cannot replace original settlement');
equal(await count('op_project_final_settlements',{project_id:projectId}),1,
 'Final settlement remains singular after retries and competing events');
equal(await count('op_project_final_release_approvals',{project_id:projectId}),0,
 'Paying full balance never automatically authorises final editable files');

console.log(`SUCCESS: ${tests} real HTTP-to-local-Supabase payment assertions.`);
