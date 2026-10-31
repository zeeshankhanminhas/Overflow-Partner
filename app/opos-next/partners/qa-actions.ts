'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaStep2Backend} from '@/lib/qa/isolation';

const QA_ORG='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
const QA_PARTNER='4f6bdcc5-1ea0-4dce-aa39-2fbef0cd17fa';
const partnerPath='/opos-next/partners/'+QA_PARTNER;
export async function approveQaPartnerReadinessAction(formData:FormData){
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
    // Restricted to a known isolated fixture; never use in commercial environments.
    const now=new Date().toISOString();
    const {data:changed,error:updateError}=await supabase.from('partners')
      .update({nda_signed:true,nda_signed_at:now,status:'approved',
        notes:'SYNTHETIC QA ONLY — simulated NDA and approval; NOT a real executed agreement. '+rationale})
      .eq('organisation_id',QA_ORG).eq('id',QA_PARTNER)
      .eq('status','prospective').eq('nda_signed',false).select('id').maybeSingle();
    if(updateError||!changed)throw new Error('QA approval was not applied; check access controls.');
    const {error:auditError}=await supabase.from('activity_events').insert({
      organisation_id:QA_ORG,entity_type:'partner',entity_id:QA_PARTNER,user_id:user.id,
      event_type:'qa.partner_simulated_readiness_approved',
      event_data:{synthetic:true,legalNdaExecuted:false,previousStatus:'prospective',
        newStatus:'approved',simulationAcknowledged:true,rationale,at:now}
    });
    if(auditError)throw new Error('QA approval applied but audit failed: '+auditError.message);
  }catch(error){errorMessage=error instanceof Error?error.message:'QA readiness action failed';}
  revalidatePath(partnerPath);revalidatePath('/opos-next/partners');
  revalidatePath('/opos-next/opportunities/dcaad06e-853d-466a-af5a-08b7ae7cc24d');
  redirect(partnerPath+(errorMessage?'?error='+encodeURIComponent(errorMessage.slice(0,300)):'?approved=1'));
}
