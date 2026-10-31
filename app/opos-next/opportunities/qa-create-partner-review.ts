'use server';
import {randomBytes,createHash} from 'crypto';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import {revalidatePath} from 'next/cache';
const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const PROSPECT='dcaad06e-853d-466a-af5a-08b7ae7cc24d';
export async function createNorthfieldQaPartnerReview(_previous:{ok:boolean;message:string},formData:FormData):Promise<{ok:boolean;message:string}>{
 try{
  if(!isKnownIsolatedQaStep2Backend()||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ukcamenuxhdznxaxpyis.supabase.co')throw Error('Isolated QA write gate closed.');
  const {supabase,user,profile,organisationId}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  if(organisationId!==ORG||String(formData.get('prospect_id'))!==PROSPECT)throw Error('Only Northfield QA may use this action.');
  const token=randomBytes(32).toString('hex');
  const hash=createHash('sha256').update(token).digest('hex');
  const {data,error}=await supabase.rpc('op_qa_issue_northfield_partner_review',{p_token_hash:hash});
  if(error)throw Error(error.message);
  if(!data)throw Error('QA assessment draft was not returned.');
  // Do not reveal the bearer token in the UI or queue an invitation before the
  // separate QA-only Resend delivery path is configured and verified.
  revalidatePath('/opos-next/opportunities/'+PROSPECT);
  return {ok:true,message:'Northfield partner assessment draft created and engineering PDF linked. Email delivery is still blocked pending controlled QA sender integration.'};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Unable to create QA draft.'};}
}
