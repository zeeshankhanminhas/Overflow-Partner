import type { SupabaseClient } from '@supabase/supabase-js';
import type { Company, Contact, Prospect, Lead, TechnicalIntake, DocumentRecord } from '@/types/domain';
import type { CompanyInput } from '@/lib/validation/companies';

export async function listCompanies(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase.from('companies').select('*').eq('organisation_id', organisationId).order('name').limit(100);
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
  const [intakesResult, documentsResult, quotesResult, projectsResult, invoicesResult] = leadIds.length ? await Promise.all([
    supabase.from('technical_intakes').select('*').eq('organisation_id', organisationId).in('lead_id', leadIds).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('organisation_id', organisationId).in('lead_id', leadIds).order('created_at', { ascending: false }),
    supabase.from('quotes').select('id,lead_id,quote_number,status,total,currency,valid_until,issued_at,accepted_at').eq('organisation_id',organisationId).in('lead_id',leadIds).order('created_at',{ascending:false}),
    supabase.from('projects').select('id,lead_id,project_number,title,status,project_stage,due_date,quote_id').eq('organisation_id',organisationId).in('lead_id',leadIds).order('created_at',{ascending:false}),
    supabase.from('invoices').select('id,lead_id,project_id,invoice_number,status,total,amount_paid,currency,due_date').eq('organisation_id',organisationId).in('lead_id',leadIds).order('created_at',{ascending:false}),
  ]) : [{ data: [] }, { data: [] }, {data:[]}, {data:[]}, {data:[]}];
  return {
    company,
    contacts: (contactsResult.data ?? []) as Contact[],
    prospects: (prospectsResult.data ?? []) as Prospect[],
    leads,
    technicalIntakes: (intakesResult.data ?? []) as TechnicalIntake[],
    documents: (documentsResult.data ?? []) as DocumentRecord[],
    quotes: quotesResult.data ?? [],
    projects: projectsResult.data ?? [],
    invoices: invoicesResult.data ?? [],
    activity: activityResult.data ?? [],
  };
}

export async function createCompany(supabase: SupabaseClient, organisationId: string, userId: string, input: CompanyInput) {
  const name=input.name.trim();
  const {data:duplicate,error:duplicateError}=await supabase.from('companies').select('id,name').eq('organisation_id',organisationId).ilike('name',name).limit(1).maybeSingle();
  if(duplicateError)throw new Error(duplicateError.message);
  if(duplicate)throw new Error(`A company named ${duplicate.name} already exists. Open the existing company instead of creating a duplicate.`);
  const { data, error } = await supabase.from('companies').insert({ organisation_id: organisationId, created_by: userId, name, website: input.website || null, industry: input.industry || null, country: input.country || null, employee_count: input.employee_count === '' || input.employee_count === undefined ? null : input.employee_count, notes: input.notes || null }).select('*').single();
  if (error) throw new Error(error.message);
  return data as Company;
}
