'use server';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import {revalidatePath} from 'next/cache';
const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const PROSPECT='dcaad06e-853d-466a-af5a-08b7ae7cc24d';
const REVIEW='e8d6be99-5b5a-446b-a071-cc5c05a102c7';
type State={ok:boolean;message:string;caseId?:string};
export async function createNorthfieldQaCase(_prior:State,form:FormData):Promise<State>{
 try{
  if(!isKnownIsolatedQaStep2Backend()||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ukcamenuxhdznxaxpyis.supabase.co')
   throw Error('Only isolated Northfield QA may create this Case.');
  const {supabase,organisationId,user,profile}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  if(organisationId!==ORG||form.get('prospect_id')!==PROSPECT||form.get('confirm')!=='yes')
   throw Error('QA record and confirmation mismatch.');
  const {data:prospect,error:pe}=await supabase.from('prospects')
    .select('status,converted_lead_id').eq('id',PROSPECT).eq('organisation_id',ORG).single();
  if(pe||!prospect)throw Error('Northfield opportunity unavailable.');
  if(prospect.converted_lead_id)
   return {ok:true,message:'Northfield Case 360 already exists. No duplicate created.',caseId:prospect.converted_lead_id};
  if(prospect.status!=='qualified')throw Error('Northfield is not qualified for Case 360.');
  const {data:review,error:re}=await supabase.from('partner_review_requests')
   .select('status').eq('id',REVIEW).eq('organisation_id',ORG).eq('prospect_id',PROSPECT).single();
  if(re||!review||!['approved','approved_with_conditions'].includes(review.status))throw Error('Approved partner technical review missing.');
  const {data:lead,error}=await supabase.rpc('op_convert_prospect',{
   p_organisation_id:ORG,p_user_id:user.id,p_prospect_id:PROSPECT
  });
  if(error||!lead?.id)throw Error(error?.message||'Case creation returned no record.');
  revalidatePath('/opos-next/opportunities/'+PROSPECT);
  revalidatePath('/opos-next/cases/'+lead.id);
  return {ok:true,message:'QA Case 360 created from approved Northfield evidence.',caseId:lead.id};
 }catch(e){return {ok:false,message:e instanceof Error?e.message:'Case conversion failed.'};}
}
