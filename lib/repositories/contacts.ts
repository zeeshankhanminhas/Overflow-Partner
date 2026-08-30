import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact } from '@/types/domain';
import type { ContactInput } from '@/lib/validation/contacts';

export async function listContacts(supabase: SupabaseClient, organisationId: string, companyId?: string) {
  let query = supabase.from('contacts').select('*, company:companies(id,name)').eq('organisation_id', organisationId).order('full_name');
  if (companyId) query = query.eq('company_id', companyId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

export async function getContactById(supabase: SupabaseClient, organisationId: string, contactId: string) {
  const { data, error } = await supabase.from('contacts').select('*, company:companies(id,name)').eq('organisation_id', organisationId).eq('id', contactId).single();
  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function createContact(supabase: SupabaseClient, organisationId: string, userId: string, input: ContactInput) {
  const email=String(input.email||'').trim().toLowerCase();
  if(email){
    const {data:duplicate,error:duplicateError}=await supabase.from('contacts').select('id,full_name,email,company_id').eq('organisation_id',organisationId).ilike('email',email).limit(1).maybeSingle();
    if(duplicateError)throw new Error(duplicateError.message);
    if(duplicate)throw new Error(`A contact with ${email} already exists: ${duplicate.full_name}. Open the existing contact instead of creating a duplicate.`);
  }
  const { data, error } = await supabase.from('contacts').insert({
    organisation_id: organisationId,
    created_by: userId,
    company_id: input.company_id || null,
    full_name: input.full_name.trim(),
    job_title: input.job_title || null,
    email: email || null,
    phone: input.phone || null,
    linkedin_url: input.linkedin_url || null,
    notes: input.notes || null,
  }).select('*, company:companies(id,name)').single();
  if (error) throw new Error(error.message);
  return data as Contact;
}
