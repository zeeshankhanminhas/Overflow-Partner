'use server';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';

const QA_ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const QA_PARTNER='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa';
const partnerPath='/opos-next/partners/'+QA_PARTNER;
export async function approveQaPartnerReadinessAction(_previous:{ok:boolean;message:string},formData:FormData):Promise<{ok:boolean;message:string}>{
  let errorMessage='';
  try{
    if(!isKnownIsolatedQaStep2Backend() || process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://ukcamenuxhdznxaxpyis.supabase.co')
      throw new Error('Isolated QA-only approval gate is closed.');
    const {supabase,organisationId,profile,user}=await requireUserContext('/opos-next');
    assertRole(profile.role,['owner','admin']);
    if(organisationId!==QA_ORG || String(formData.get('partner_id'))!==QA_PARTNER)
      throw new Error('This action only supports the approved fictional QA fixture.');
    if(formData.get('simulation_ack')!=='yes')
      throw new Error('Acknowledge that this is a simulated QA NDA, not a legally signed agreement.');
    const rationale=String(formData.get('rationale')||'').trim();
    if(rationale.length<15 || rationale.length>1000)
      throw new Error('Enter a QA approval rationale of 15–1000 characters.');
    const {data:partner,error}=await supabase.from('partners')
      .select('id,company_name,email,status,nda_signed').eq('organisation_id',QA_ORG).eq('id',QA_PARTNER).single();
    if(error||!partner||partner.company_name!=='QA - Precision Mechanical Design Ltd'||
      !String(partner.email||'').endsWith('+partner@gmail.com')||
      partner.status!=='prospective'||partner.nda_signed)
      throw new Error('The QA partner is not in its expected prospective state.');
    // Simulated approval is evidence only. Never change real NDA or partner status.
    const {data:existing,error:existingError}=await supabase.from('activity_events')
      .select('id').eq('organisation_id',QA_ORG).eq('entity_type','partner')
      .eq('entity_id',QA_PARTNER).eq('event_type','qa.partner_simulated_readiness_approved')
      .limit(1).maybeSingle();
    if(existingError)throw new Error('Cannot inspect QA approval evidence: '+existingError.message);
    if(existing)throw new Error('This QA simulation has already been recorded.');
    const {error:auditError}=await supabase.from('activity_events').insert({
      organisation_id:QA_ORG,entity_type:'partner',entity_id:QA_PARTNER,user_id:user.id,
      event_type:'qa.partner_simulated_readiness_approved',
      event_data:{synthetic:true,legalNdaExecuted:false,partnerStatusUnchanged:'prospective',
        simulationAcknowledged:true,rationale,at:new Date().toISOString()}
    });
    if(auditError)throw new Error('QA simulated approval could not be recorded: '+auditError.message);
  }catch(error){errorMessage=error instanceof Error?error.message:'QA readiness action failed';}
  if(errorMessage)return {ok:false,message:errorMessage.slice(0,300)};
  revalidatePath(partnerPath);
  revalidatePath('/opos-next/partners');
  return {ok:true,message:'Synthetic QA evidence recorded. Real NDA and approval remain unchanged.'};
}
