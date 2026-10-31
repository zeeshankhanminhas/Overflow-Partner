'use server';
import {randomBytes,createHash} from 'crypto';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import {revalidatePath} from 'next/cache';
const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const PROSPECT='dcaad06e-853d-466a-af5a-08b7ae7cc24d';
const REQUEST='e8d6be99-5b5a-446b-a071-cc5c05a102c7';
export async function issueNorthfieldQaReview(_prior:{ok:boolean;message:string;url?:string},data:FormData):Promise<{ok:boolean;message:string;url?:string}>{
 try{
  if(!isKnownIsolatedQaStep2Backend()||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ukcamenuxhdznxaxpyis.supabase.co')throw Error('Isolated QA backend not verified.');
  const {supabase,profile,organisationId}=await requireUserContext('/opos-next');assertRole(profile.role,['owner','admin']);
  if(organisationId!==ORG||data.get('request_id')!==REQUEST||data.get('confirm')!=='yes')throw Error('Authorised QA issue confirmation required.');
  const token=randomBytes(32).toString('hex'),tokenHash=createHash('sha256').update(token).digest('hex');
  const {data:requestId,error}=await supabase.rpc('op_qa_issue_existing_northfield_review',{p_request_id:REQUEST,p_token_hash:tokenHash});
  if(error||requestId!==REQUEST)throw Error(error?.message||'Unable to issue QA review.');
  revalidatePath('/opos-next/opportunities/'+PROSPECT);
  const origin=process.env.VERCEL_URL||process.env.NEXT_PUBLIC_SITE_URL||'';
  if(!origin)throw Error('QA portal base URL missing; assessment was issued. Contact administrator for secure link recovery.');
  return {ok:true,message:'Secure QA partner review link issued. No email sent; this is a controlled manual QA handover.',url:(origin.startsWith('https://')?origin:'https://'+origin)+'/partner-review/'+token};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'Unable to issue QA review.'};}
}
