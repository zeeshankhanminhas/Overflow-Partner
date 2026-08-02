import type { SupabaseClient } from '@supabase/supabase-js';
import type { Company, Contact, Prospect, Lead, TechnicalIntake, DocumentRecord } from '@/types/domain';
import type { CompanyInput } from '@/lib/validation/companies';

export async function listCompanies(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase.from('companies').select('*').eq('organisation_id', organisationId).order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
}

export async function getCompanyById(supabase: SupabaseClient, organisationId: string, companyId: string) {
  const { data, error } = await supabase.from('companies').select('*').eq('organisation_id', organisationId).eq('id', companyId).single();
  if (error) throw new Error(error.message);
  return data as Company;
}

export async function getCompany360(supabase: SupabaseClient, organisationId: string, companyId: string) {
  const company = await getCompanyById(supabase, organisationId, companyId);
  const [contactsResult, prospectsResult, leadsResult, activityResult] = await Promise.all([
    supabase.from('contacts').select('*').eq('organisation_id', organisationId).eq('company_id', companyId).order('full_name'),
    supabase.from('prospects').select('*').eq('organisation_id', organisationId).eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('leads').select('*').eq('organisation_id', organisationId).eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('activity_events').select('*').eq('organisation_id', organisationId).eq('entity_type', 'company').eq('entity_id', companyId).order('created_at', { ascending: false }).limit(12),
  ]);
  const leads = (leadsResult.data ?? []) as Lead[];
  const leadIds = leads.map((lead) => lead.id);
  const [intakesResult, documentsResult] = leadIds.length ? await Promise.all([
    supabase.from('technical_intakes').select('*').eq('organisation_id', organisationId).in('lead_id', leadIds).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('organisation_id', organisationId).in('lead_id', leadIds).order('created_at', { ascending: false }),
  ]) : [{ data: [] }, { data: [] }];
  return {
    company,
    contacts: (contactsResult.data ?? []) as Contact[],
    prospects: (prospectsResult.data ?? []) as Prospect[],
    leads,
    technicalIntakes: (intakesResult.data ?? []) as TechnicalIntake[],
    documents: (documentsResult.data ?? []) as DocumentRecord[],
    activity: activityResult.data ?? [],
  };
}

export async function createCompany(supabase: SupabaseClient, organisationId: string, userId: string, input: CompanyInput) {
  const { data, error } = await supabase.from('companies').insert({ organisation_id: organisationId, created_by: userId, name: input.name, website: input.website || null, industry: input.industry || null, country: input.country || null, employee_count: input.employee_count === '' || input.employee_count === undefined ? null : input.employee_count, notes: input.notes || null }).select('*').single();
  if (error) throw new Error(error.message);
  return data as Company;
}
