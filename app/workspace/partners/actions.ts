'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertRole, requireUserContext } from '@/lib/auth/context';

const partnerAuthorityRoles = ['owner','admin','commercial'] as const;

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}

function destination(params: Record<string,string>) {
  return `/workspace/partners?${new URLSearchParams(params).toString()}`;
}

async function audit(supabase:any, organisationId:string, userId:string, partnerId:string, eventType:string, eventData:Record<string,unknown>) {
  await supabase.rpc('op_record_activity', {
    p_organisation_id: organisationId,
    p_user_id: userId,
    p_entity_type: 'partner',
    p_entity_id: partnerId,
    p_event_type: eventType,
    p_event_data: eventData,
  });
}

export async function approvePartnerAction(formData: FormData) {
  const partnerId = required(formData,'partner_id');
  let next = '/workspace/partners';
  try {
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...partnerAuthorityRoles]);
    const {data:partner,error:readError}=await supabase.from('partners').select('id,company_name,status').eq('organisation_id',organisationId).eq('id',partnerId).single();
    if(readError||!partner) throw new Error(readError?.message||'Partner not found.');
    if(partner.status==='approved') throw new Error('Partner is already approved.');
    const {error}=await supabase.from('partners').update({status:'approved',updated_at:new Date().toISOString()}).eq('organisation_id',organisationId).eq('id',partnerId);
    if(error) throw new Error(error.message);
    await audit(supabase,organisationId,user.id,partnerId,'partner.approved',{fromStatus:partner.status,toStatus:'approved'});
    revalidatePath('/workspace/partners');
    next=destination({updated:`${partner.company_name} approved.`});
  } catch(error) {
    next=destination({error:error instanceof Error?error.message:'Partner could not be approved.'});
  }
  redirect(next);
}

export async function suspendPartnerAction(formData: FormData) {
  const partnerId = required(formData,'partner_id');
  const reason = required(formData,'reason');
  let next = '/workspace/partners';
  try {
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,[...partnerAuthorityRoles]);
    const {data:partner,error:readError}=await supabase.from('partners').select('id,company_name,status').eq('organisation_id',organisationId).eq('id',partnerId).single();
    if(readError||!partner) throw new Error(readError?.message||'Partner not found.');
    if(partner.status==='suspended') throw new Error('Partner is already suspended.');
    const {error}=await supabase.from('partners').update({status:'suspended',updated_at:new Date().toISOString()}).eq('organisation_id',organisationId).eq('id',partnerId);
    if(error) throw new Error(error.message);
    await audit(supabase,organisationId,user.id,partnerId,'partner.suspended',{fromStatus:partner.status,toStatus:'suspended',reason});
    revalidatePath('/workspace/partners');
    next=destination({updated:`${partner.company_name} suspended.`});
  } catch(error) {
    next=destination({error:error instanceof Error?error.message:'Partner could not be suspended.'});
  }
  redirect(next);
}
