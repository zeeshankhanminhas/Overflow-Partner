'use server';
import {revalidatePath} from 'next/cache';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {assertIsolatedQaBackend} from '@/lib/qa/isolation';

export type GovernanceResult={ok:boolean;message:string};
const fail=(error:unknown):GovernanceResult=>({ok:false,message:(error instanceof Error?error.message:'Action failed').slice(0,360)});
export async function verifySignedPartnerNda(
  _previous:GovernanceResult,form:FormData,
):Promise<GovernanceResult>{
  try{
    // Governed controls are QA-preview-only until human production promotion.
    assertIsolatedQaBackend();
    const {supabase,organisationId,profile}=await requireUserContext('/opos-next');
    assertRole(profile.role,['owner','admin']);
    if(form.get('verified_external_evidence')!=='yes')
      throw new Error('Confirm you reviewed genuinely executed signed NDA evidence. A simulation is not permitted.');
    const partnerId=String(form.get('partner_id')||'');
    const reference=String(form.get('evidence_reference')||'').trim();
    const signatory=String(form.get('signed_by_name')||'').trim();
    const signedValue=String(form.get('signed_at')||'').trim();
    const signedAt=new Date(signedValue);
    if(!/^[0-9a-f-]{36}$/i.test(partnerId)||reference.length<8||signatory.length<3||
        !signedValue||Number.isNaN(signedAt.valueOf())||signedAt.valueOf()>Date.now())
      throw new Error('Valid partner, signed document reference, signatory and actual date are required.');
    const {data,error}=await supabase.rpc('op_verify_partner_nda',{
      p_organisation_id:organisationId,p_partner_id:partnerId,p_evidence_reference:reference,
      p_signed_by_name:signatory,p_signed_at:signedAt.toISOString(),
    });
    if(error||!data?.verified)throw new Error(error?.message||'NDA verification was not confirmed.');
    revalidatePath('/opos-next/partners/'+partnerId);
    revalidatePath('/opos-next/partners');
    return {ok:true,message:'Signed NDA evidence verification recorded with reviewer audit. Partner approval remains a separate decision.'};
  }catch(error){return fail(error);}
}
export async function approvePartnerAfterNda(
  _previous:GovernanceResult,form:FormData,
):Promise<GovernanceResult>{
  try{
    assertIsolatedQaBackend();
    const {supabase,organisationId,profile}=await requireUserContext('/opos-next');
    assertRole(profile.role,['owner','admin']);
    if(form.get('capability_review_confirmed')!=='yes')
      throw new Error('Confirm you reviewed independent technical capability evidence.');
    const partnerId=String(form.get('partner_id')||'');
    const reference=String(form.get('capability_evidence_reference')||'').trim();
    const rationale=String(form.get('decision_note')||'').trim();
    if(!/^[0-9a-f-]{36}$/i.test(partnerId)||reference.length<8||rationale.length<15)
      throw new Error('Partner, capability evidence and decision rationale are required.');
    const {data,error}=await supabase.rpc('op_approve_partner_governed',{
      p_organisation_id:organisationId,p_partner_id:partnerId,
      p_capability_evidence_reference:reference,p_decision_note:rationale,
    });
    if(error||!data?.approved)throw new Error(error?.message||'Partner approval was not confirmed.');
    revalidatePath('/opos-next/partners/'+partnerId);
    revalidatePath('/opos-next/partners');
    return {ok:true,message:'Internal partner approval recorded separately from signed NDA evidence. All future quotation gates remain enforced.'};
  }catch(error){return fail(error);}
}
