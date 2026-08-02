import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, LeadStatus } from '@/types/domain';
import type { LeadInput } from '@/lib/validation/leads';

export async function listLeads(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

export async function getLeadById(
  supabase: SupabaseClient,
  organisationId: string,
  leadId: string,
) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('id', leadId)
    .single();

  if (error) throw new Error(error.message);
  return data as Lead;
}

export async function createLead(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  input: LeadInput,
) {
  const { data, error } = await supabase
    .from('leads')
    .insert({
      ...input,
      organisation_id: organisationId,
      created_by: userId,
      owner_id: userId,
      contact_name: input.contact_name || null,
      contact_email: input.contact_email || null,
      project_type: input.project_type || null,
      title: input.title || null,
      service: input.service || null,
      notes: input.notes || null,
      prospect_id: input.prospect_id ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Lead;
}

export async function updateLeadStatus(
  supabase: SupabaseClient,
  organisationId: string,
  leadId: string,
  status: LeadStatus,
) {
  const { data, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('organisation_id', organisationId)
    .eq('id', leadId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Lead;
}
