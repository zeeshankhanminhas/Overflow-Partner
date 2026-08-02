import type { SupabaseClient } from '@supabase/supabase-js';
import type { Company } from '@/types/domain';
import type { CompanyInput } from '@/lib/validation/companies';

export async function listCompanies(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name');

  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
}

export async function createCompany(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  input: CompanyInput,
) {
  const { data, error } = await supabase
    .from('companies')
    .insert({
      organisation_id: organisationId,
      created_by: userId,
      name: input.name,
      website: input.website || null,
      industry: input.industry || null,
      country: input.country || null,
      employee_count: input.employee_count === '' || input.employee_count === undefined ? null : input.employee_count,
      notes: input.notes || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Company;
}
