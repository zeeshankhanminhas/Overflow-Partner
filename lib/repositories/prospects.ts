import type { SupabaseClient } from '@supabase/supabase-js';
import type { Prospect } from '@/types/domain';
import type { ProspectInput } from '@/lib/validation/prospects';

export async function listProspects(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Prospect[];
}

export async function getProspectById(
  supabase: SupabaseClient,
  organisationId: string,
  prospectId: string,
) {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('id', prospectId)
    .single();

  if (error) throw new Error(error.message);
  return data as Prospect;
}

export async function createProspect(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  input: ProspectInput,
) {
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      ...input,
      organisation_id: organisationId,
      created_by: userId,
      assigned_to: userId,
      contact_name: input.contact_name || null,
      job_title: input.job_title || null,
      linkedin_url: input.linkedin_url || null,
      email: input.email || null,
      phone: input.phone || null,
      industry: input.industry || null,
      next_action: input.next_action || null,
      next_action_at: input.next_action_at || null,
      notes: input.notes || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Prospect;
}

export async function markProspectConverted(
  supabase: SupabaseClient,
  prospectId: string,
  leadId: string,
) {
  const { data, error } = await supabase
    .from('prospects')
    .update({ status: 'converted', converted_lead_id: leadId })
    .eq('id', prospectId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Prospect;
}
