'use server';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';
import {revalidatePath} from 'next/cache';
const ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const PARTNER='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa';
const PROSPECT='dcaad06e-853d-466a-af5a-08b7ae7cc24d';
const SESSION='9a4863dd-22d3-420f-b0fd-50ff0f3bfda9';
const EVENT='qa.partner_assessment_handoff_rehearsed';
export async function rehearseQaPartnerHandoff(_previous:{ok:boolean;message:string},formData:FormData):Promise<{ok:boolean;message:string}>{
 try{
  if(!isKnownIsolatedQaStep2Backend()||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ukcamenuxhdznxaxpyis.supabase.co')
   throw new Error('QA-only backend not verified.');
  const {supabase,organisationId,user,profile}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  if(organisationId!==ORG||formData.get('partner_id')!==PARTNER||formData.get('prospect_id')!==PROSPECT)
   throw new Error('Only the designated synthetic QA records may be tested.');
  const [partner,session,simulation,files,existing]=await Promise.all([
   supabase.from('partners').select('id,status,nda_signed,email').eq('organisation_id',ORG).eq('id',PARTNER).single(),
   supabase.from('intake_sessions').select('id,status').eq('organisation_id',ORG).eq('id',SESSION).eq('prospect_id',PROSPECT).single(),
   supabase.from('activity_events').select('id').eq('organisation_id',ORG).eq('entity_type','partner').eq('entity_id',PARTNER).eq('event_type','qa.partner_simulated_readiness_approved').limit(1).maybeSingle(),
   supabase.from('intake_files').select('id,original_filename,storage_path').eq('organisation_id',ORG).eq('intake_session_id',SESSION),
   supabase.from('activity_events').select('id').eq('organisation_id',ORG).eq('entity_type','prospect').eq('entity_id',PROSPECT).eq('event_type',EVENT).limit(1).maybeSingle()
  ]);
  if(partner.error||session.error||simulation.error||files.error||existing.error)throw new Error('QA evidence query failed; check access permissions.');
  if(partner.data?.status!=='prospective'||partner.data?.nda_signed!==false||session.data?.status!=='submitted'||!simulation.data)
   throw new Error('Simulation and submitted intake prerequisites must be verified; real NDA and approval must remain unset.');
  if(!files.data?.length)throw new Error('No registered engineering source document to hand over.');
  if(existing.data)return {ok:true,message:'QA handoff rehearsal was already recorded. No duplicate created.'};
  const {error}=await supabase.from('activity_events').insert({organisation_id:ORG,entity_type:'prospect',entity_id:PROSPECT,user_id:user.id,event_type:EVENT,event_data:{
   synthetic:true,realPartnerInvited:false,ndaExecuted:false,partnerId:PARTNER,intakeSessionId:SESSION,
   fileIds:files.data.map(f=>f.id),storageDownloadVerified:false,providerMessageId:null,
   note:'QA-only prerequisite and handoff metadata rehearsal; no partner-review request or external delivery.'
  }});
  if(error)throw new Error('Handoff rehearsal audit could not be recorded: '+error.message);
  revalidatePath('/opos-next/opportunities/'+PROSPECT);
  return {ok:true,message:'QA handoff prerequisites recorded. Secure file download and partner invitation still need separate tests.'};
 }catch(error){return {ok:false,message:error instanceof Error?error.message:'QA rehearsal failed.'};}
}
