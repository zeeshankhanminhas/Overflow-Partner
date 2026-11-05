'use server';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import {revalidatePath} from 'next/cache';
const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const PROSPECT='dcaad06e-853d-466a-af5a-08b7ae7cc24d';
const REQUEST='e8d6be99-5b5a-446b-a071-cc5c05a102c7';
const RESPONSE='aca6a301-fa83-47e5-b205-0365892cd7ac';
export type QaDecisionState={ok:boolean;message:string};
export async function decideNorthfieldQa(_prior:QaDecisionState,form:FormData):Promise<QaDecisionState>{
 try{
  if(!isKnownIsolatedQaStep2Backend()||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ukcamenuxhdznxaxpyis.supabase.co')throw Error('Isolated QA environment is not verified.');
  const {supabase,organisationId,profile,user}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  if(organisationId!==ORG||String(form.get('prospect_id'))!==PROSPECT||
      String(form.get('request_id'))!==REQUEST||String(form.get('response_id'))!==RESPONSE)
    throw Error('Only the designated Northfield QA assessment may be approved here.');
  const decision=String(form.get('decision')||'');
  if(!['approved','approved_with_conditions','clarification_required','rejected'].includes(decision))throw Error('Invalid decision.');
  const notes=String(form.get('review_notes')||'').trim();
  const assumptions=String(form.get('accepted_assumptions')||'').trim();
  const risks=String(form.get('accepted_risks')||'').trim();
  const clarification=String(form.get('clarification_request')||'').trim();
  if(notes.length<20||notes.length>5000)throw Error('A decision rationale of at least 20 characters is required.');
  if(decision==='clarification_required'&&!clarification)throw Error('Clarification request is required.');
  const {data:request,error:requestError}=await supabase.from('partner_review_requests')
    .select('id,status,partner_id').eq('organisation_id',ORG).eq('prospect_id',PROSPECT).eq('id',REQUEST).single();
  if(requestError||request?.status!=='submitted'||request.partner_id!=='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa')
    throw Error('Assessment is not awaiting the designated QA internal decision.');
  const {data:response,error:responseError}=await supabase.from('partner_review_responses')
    .select('id,feasibility').eq('organisation_id',ORG).eq('partner_review_request_id',REQUEST).eq('id',RESPONSE).single();
  if(responseError||!response)throw Error('QA partner response missing.');
  const {error}=await supabase.rpc('op_decide_prospect_partner_review',{
   p_organisation_id:ORG,p_user_id:user.id,p_prospect_id:PROSPECT,p_request_id:REQUEST,p_response_id:RESPONSE,
   p_decision:decision,p_review_notes:'[ISOLATED QA] '+notes,p_accepted_assumptions:assumptions||null,
   p_accepted_risks:risks||null,p_clarification_request:clarification||null
  });
  if(error)throw Error(error.message);
  revalidatePath('/opos-next/opportunities/'+PROSPECT);
  return {ok:true,message:'Northfield QA internal decision recorded. Refresh to continue to the next governed stage.'};
 }catch(e){return {ok:false,message:e instanceof Error?e.message:'QA decision failed.'};}
}
