import type { SupabaseClient } from '@supabase/supabase-js';
import type { Partner, PartnerQuote, CommercialReview, ClientQuote, Project, Task, Profile, ActivityEvent } from '@/types/domain';
import type { PartnerInput, PartnerQuoteInput, CommercialReviewInput, ClientQuoteInput, ProjectInput, TaskInput } from '@/lib/validation/workflow';
import { assertUniqueProjectNumber } from '@/lib/business/identifierIntegrity';
import { RecordNotFoundError } from '@/lib/repositories/errors';

function nullable(value: unknown) { return value === '' || value === undefined ? null : value; }

export async function listPartners(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase.from('partners').select('*').eq('organisation_id', organisationId).order('company_name');
  if (error) throw new Error(error.message); return (data ?? []) as Partner[];
}
export async function createPartner(supabase: SupabaseClient, organisationId: string, userId: string, input: PartnerInput) {
  const { data, error } = await supabase.from('partners').insert({ organisation_id: organisationId, created_by: userId, company_name: input.company_name, country: nullable(input.country), services: input.services, contact_name: nullable(input.contact_name), email: nullable(input.email), phone: nullable(input.phone), nda_signed: input.nda_signed === 'true', nda_signed_at: input.nda_signed === 'true' ? new Date().toISOString() : null, status: input.status, rating: nullable(input.rating), notes: nullable(input.notes) }).select('*').single();
  if (error) throw new Error(error.message); return data as Partner;
}

export async function listPartnerQuotes(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase.from('partner_quotes').select('*, partner:partners(id,company_name), lead:leads(id,title,company_name), partner_review:partner_review_requests(id,case_reference,status)').eq('organisation_id', organisationId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message); return (data ?? []) as PartnerQuote[];
}
export async function createPartnerQuote(supabase: SupabaseClient, organisationId: string, userId: string, input: PartnerQuoteInput) {
  const { data, error } = await supabase.from('partner_quotes').insert({
    organisation_id: organisationId, created_by: userId,
    partner_review_request_id: input.partner_review_request_id,
    partner_review_response_id: nullable(input.partner_review_response_id),
    partner_id: input.partner_id, lead_id: input.lead_id,
    technical_intake_id: nullable(input.technical_intake_id),
    price: input.price, currency: input.currency.toUpperCase(),
    lead_time_days: nullable(input.lead_time_days), valid_until: nullable(input.valid_until),
    commercial_assumptions: nullable(input.commercial_assumptions), exclusions: nullable(input.exclusions),
    payment_terms: nullable(input.payment_terms), delivery_commitment: nullable(input.delivery_commitment),
    quote_reference: nullable(input.quote_reference), notes: nullable(input.notes), status: input.status,
    submitted_at: input.status === 'received' ? new Date().toISOString() : null,
  }).select('*').single();
  if (error) throw new Error(error.message); return data as PartnerQuote;
}

export async function listCommercialReviews(supabase: SupabaseClient, organisationId: string) { const { data, error } = await supabase.from('commercial_reviews').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }); if (error) throw new Error(error.message); return (data ?? []) as CommercialReview[]; }
export async function createCommercialReview(supabase: SupabaseClient, organisationId: string, userId: string, input: CommercialReviewInput) { const marginAmount=input.client_price-input.cost_price; const marginPercent=input.client_price>0?(marginAmount/input.client_price)*100:0; const {data,error}=await supabase.from('commercial_reviews').insert({organisation_id:organisationId,created_by:userId,lead_id:input.lead_id,partner_quote_id:nullable(input.partner_quote_id),cost_price:input.cost_price,client_price:input.client_price,margin_amount:marginAmount,margin_percent:marginPercent,status:input.status,approved_by:input.status==='approved'?userId:null,approved_at:input.status==='approved'?new Date().toISOString():null}).select('*').single(); if(error)throw new Error(error.message); return data as CommercialReview; }
export async function listClientQuotes(supabase: SupabaseClient, organisationId: string) {
  const {data,error}=await supabase.from('quotes').select('*, lead:leads(id,title,company_name,contact_name), commercial_review:commercial_reviews(id,cost_price,client_price,margin_amount,margin_percent,status)').eq('organisation_id',organisationId).order('created_at',{ascending:false});
  if(error)throw new Error(error.message); return (data??[]) as ClientQuote[];
}
export async function createClientQuote(supabase: SupabaseClient, organisationId: string, userId: string, input: ClientQuoteInput) { const total=input.subtotal+input.vat; const now=new Date().toISOString(); const {data,error}=await supabase.from('quotes').insert({organisation_id:organisationId,created_by:userId,lead_id:input.lead_id,commercial_review_id:nullable(input.commercial_review_id),quote_number:input.quote_number,revision:input.revision,subtotal:input.subtotal,vat:input.vat,total,currency:input.currency.toUpperCase(),valid_until:nullable(input.valid_until),status:input.status,issued_at:input.status==='issued'?now:null,accepted_at:input.status==='accepted'?now:null}).select('*').single(); if(error)throw new Error(error.message); return data as ClientQuote; }
export async function listProjects(supabase: SupabaseClient, organisationId: string) { const {data,error}=await supabase.from('projects').select('*').eq('organisation_id',organisationId).order('created_at',{ascending:false}); if(error)throw new Error(error.message); return (data??[]) as Project[]; }
export async function getProjectById(supabase: SupabaseClient, organisationId: string, projectId: string) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('id', projectId)
    .maybeSingle();

  if (projectError) throw new Error(projectError.message);
  if (!project) throw new RecordNotFoundError('Project');

  const [leadResult, quoteResult, managerResult] = await Promise.all([
    project.lead_id
      ? supabase.from('leads').select('id,title,company_name,contact_name,contact_email,project_type,status,priority').eq('organisation_id', organisationId).eq('id', project.lead_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    project.quote_id
      ? supabase.from('quotes').select('id,quote_number,revision,status,subtotal,vat,total,currency,valid_until,issued_at,accepted_at').eq('organisation_id', organisationId).eq('id', project.quote_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    project.project_manager_id
      ? supabase.from('profiles').select('id,full_name,email').eq('organisation_id', organisationId).eq('id', project.project_manager_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (leadResult.error) throw new Error(`Project lead could not be loaded: ${leadResult.error.message}`);
  if (quoteResult.error) throw new Error(`Project quote could not be loaded: ${quoteResult.error.message}`);
  if (managerResult.error) throw new Error(`Project manager could not be loaded: ${managerResult.error.message}`);

  return {
    ...project,
    lead: leadResult.data,
    quote: quoteResult.data,
    project_manager: managerResult.data,
  } as Project & {
    lead?: Record<string, unknown> | null;
    quote?: Record<string, unknown> | null;
    project_manager?: Record<string, unknown> | null;
  };
}
export async function createProject(supabase: SupabaseClient, organisationId: string, userId: string, input: ProjectInput) { const projectNumber=await assertUniqueProjectNumber(supabase,organisationId,input.project_number); const {data,error}=await supabase.from('projects').insert({organisation_id:organisationId,created_by:userId,project_manager_id:userId,lead_id:input.lead_id,quote_id:nullable(input.quote_id),project_number:projectNumber,title:input.title,status:input.status,start_date:nullable(input.start_date),due_date:nullable(input.due_date),notes:nullable(input.notes)}).select('*').single(); if(error)throw new Error(error.message); return data as Project; }
export async function listTasks(supabase: SupabaseClient, organisationId: string) { const {data,error}=await supabase.from('tasks').select('*').eq('organisation_id',organisationId).order('created_at',{ascending:false}); if(error)throw new Error(error.message); return (data??[]) as Task[]; }
export async function createTask(supabase: SupabaseClient, organisationId: string, userId: string, input: TaskInput) { const {data,error}=await supabase.from('tasks').insert({organisation_id:organisationId,created_by:userId,assigned_to:userId,entity_type:input.entity_type,entity_id:input.entity_id,title:input.title,description:nullable(input.description),priority:input.priority,status:input.status,due_at:nullable(input.due_at),completed_at:input.status==='completed'?new Date().toISOString():null}).select('*').single(); if(error)throw new Error(error.message); return data as Task; }
export async function listProfiles(supabase: SupabaseClient, organisationId: string) { const {data,error}=await supabase.from('profiles').select('*').eq('organisation_id',organisationId).order('created_at'); if(error)throw new Error(error.message); return (data??[]) as Profile[]; }
export async function listActivity(supabase: SupabaseClient, organisationId: string, limit=100) { const {data,error}=await supabase.from('activity_events').select('*').eq('organisation_id',organisationId).order('created_at',{ascending:false}).limit(limit); if(error)throw new Error(error.message); return (data??[]) as ActivityEvent[]; }
