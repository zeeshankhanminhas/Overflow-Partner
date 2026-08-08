import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClientQuote, CommercialReview, Lead, PartnerQuote, Project, TechnicalIntake } from '@/types/domain';
import type { WorkflowCase } from '@/types/orchestration';
import { buildLead360Context, inheritedSnapshot } from '@/lib/context/inheritance';
import { deriveWorkflowStage } from '@/lib/lifecycle/resolver';
import {
  assertCanAcceptQuote,
  assertCanApproveTechnical,
  assertCanConvertProspect,
  assertCanCreateCommercialReview,
  assertCanCreateTechnicalScope,
  assertCanGenerateQuote,
  assertCanIssueQuote,
} from '@/lib/business/invariants';

export async function listWorkflowCases(supabase: SupabaseClient, organisationId: string): Promise<WorkflowCase[]> {
  const [leadsResult, intakesResult, partnerQuotesResult, reviewsResult, quotesResult, projectsResult] = await Promise.all([
    supabase.from('leads').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('technical_intakes').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('partner_quotes').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('commercial_reviews').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('quotes').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
    supabase.from('projects').select('*').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
  ]);
  for (const result of [leadsResult, intakesResult, partnerQuotesResult, reviewsResult, quotesResult, projectsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const intakes = (intakesResult.data ?? []) as TechnicalIntake[];
  const partnerQuotes = (partnerQuotesResult.data ?? []) as PartnerQuote[];
  const reviews = (reviewsResult.data ?? []) as CommercialReview[];
  const quotes = (quotesResult.data ?? []) as ClientQuote[];
  const projects = (projectsResult.data ?? []) as Project[];

  return ((leadsResult.data ?? []) as Lead[]).map((lead) => {
    const technicalIntake = intakes.find((item) => item.lead_id === lead.id) ?? null;
    const partnerQuote = partnerQuotes.find((item) => item.lead_id === lead.id && item.status === 'selected')
      ?? partnerQuotes.find((item) => item.lead_id === lead.id && item.status === 'received') ?? null;
    const commercialReview = reviews.find((item) => item.lead_id === lead.id) ?? null;
    const clientQuote = quotes.find((item) => item.lead_id === lead.id) ?? null;
    const project = projects.find((item) => item.lead_id === lead.id) ?? null;
    return { lead, technicalIntake, partnerQuote, commercialReview, clientQuote, project,
      ...deriveWorkflowStage(technicalIntake, partnerQuote, commercialReview, clientQuote, project) };
  });
}

export async function getWorkflowCase(supabase: SupabaseClient, organisationId: string, leadId: string): Promise<WorkflowCase | null> {
  const leadResult = await supabase.from('leads').select('*')
    .eq('organisation_id', organisationId).eq('id', leadId).maybeSingle();
  if (leadResult.error) throw new Error(leadResult.error.message);
  if (!leadResult.data) return null;

  const [intakeResult, partnerResult, reviewResult, quoteResult, projectResult] = await Promise.all([
    supabase.from('technical_intakes').select('*').eq('organisation_id', organisationId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('partner_quotes').select('*').eq('organisation_id', organisationId).eq('lead_id', leadId).in('status', ['selected','received']).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('commercial_reviews').select('*').eq('organisation_id', organisationId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('quotes').select('*').eq('organisation_id', organisationId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('projects').select('*').eq('organisation_id', organisationId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [intakeResult, partnerResult, reviewResult, quoteResult, projectResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const lead = leadResult.data as Lead;
  const technicalIntake = (intakeResult.data as TechnicalIntake | null) ?? null;
  const partnerQuote = (partnerResult.data as PartnerQuote | null) ?? null;
  const commercialReview = (reviewResult.data as CommercialReview | null) ?? null;
  const clientQuote = (quoteResult.data as ClientQuote | null) ?? null;
  const project = (projectResult.data as Project | null) ?? null;

  return {
    lead,
    technicalIntake,
    partnerQuote,
    commercialReview,
    clientQuote,
    project,
    ...deriveWorkflowStage(technicalIntake, partnerQuote, commercialReview, clientQuote, project),
  };
}

export async function ensureTechnicalIntakeShell(
  supabase: SupabaseClient, organisationId: string, userId: string, leadId: string,
) {
  const { data: existing, error: existingError } = await supabase.from('technical_intakes').select('*')
    .eq('organisation_id', organisationId).eq('lead_id', leadId).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as TechnicalIntake;

  await assertCanCreateTechnicalScope(supabase, organisationId, leadId);
  const { data: lead, error: leadError } = await supabase.from('leads').select('*')
    .eq('organisation_id', organisationId).eq('id', leadId).single();
  if (leadError || !lead) throw new Error(leadError?.message || 'Lead 360 context could not be loaded.');

  const context = buildLead360Context(lead as Lead, null);
  const { data, error } = await supabase.from('technical_intakes').insert({
    organisation_id: organisationId,
    lead_id: lead.id,
    project_type: context.requirement.projectType,
    description: context.requirement.description,
    deliverables: context.requirement.deliverables,
    deadline: context.requirement.deadline,
    special_requirements: context.requirement.specialRequirements,
    status: 'draft',
    created_by: userId,
  }).select('*').single();
  if (error) throw new Error(error.message);

  await supabase.from('leads').update({ status: 'technical_intake' }).eq('organisation_id', organisationId).eq('id', leadId);
  await supabase.rpc('op_record_activity', {
    p_organisation_id: organisationId,
    p_user_id: userId,
    p_entity_type: 'lead',
    p_entity_id: leadId,
    p_event_type: 'technical_scope_inherited_from_lead_360',
    p_event_data: {
      technicalIntakeId: data.id,
      inherited: inheritedSnapshot(context),
      decisionInputs: {},
    },
  });
  return data as TechnicalIntake;
}

async function rpc<T>(supabase: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function approveTechnicalIntake(supabase: SupabaseClient, organisationId: string, userId: string, intakeId: string) {
  await assertCanApproveTechnical(supabase, organisationId, intakeId);
  return rpc<TechnicalIntake>(supabase, 'op_approve_technical_intake', {
    p_organisation_id: organisationId, p_user_id: userId, p_intake_id: intakeId,
  });
}

export async function createCommercialReviewFromPartnerQuote(
  supabase: SupabaseClient, organisationId: string, userId: string, partnerQuoteId: string, markupPercent: number,
) {
  await assertCanCreateCommercialReview(supabase, organisationId, partnerQuoteId);
  return rpc<CommercialReview>(supabase, 'op_create_commercial_review', {
    p_organisation_id: organisationId, p_user_id: userId, p_partner_quote_id: partnerQuoteId,
    p_markup_percent: markupPercent,
  });
}

export async function approveCommercialAndGenerateQuote(
  supabase: SupabaseClient, organisationId: string, userId: string, commercialReviewId: string,
  currency = 'GBP', vatRate = 20,
) {
  await assertCanGenerateQuote(supabase, organisationId, commercialReviewId);
  return rpc<ClientQuote>(supabase, 'op_approve_commercial_generate_quote', {
    p_organisation_id: organisationId, p_user_id: userId, p_review_id: commercialReviewId,
    p_currency: currency, p_vat_rate: vatRate,
  });
}

export async function issueClientQuote(supabase: SupabaseClient, organisationId: string, userId: string, quoteId: string) {
  await assertCanIssueQuote(supabase, organisationId, quoteId);
  return rpc<ClientQuote>(supabase, 'op_issue_quote', {
    p_organisation_id: organisationId, p_user_id: userId, p_quote_id: quoteId,
  });
}

export async function acceptQuoteAndCreateProject(supabase: SupabaseClient, organisationId: string, userId: string, quoteId: string) {
  await assertCanAcceptQuote(supabase, organisationId, quoteId);
  return rpc<Project>(supabase, 'op_accept_quote_create_project', {
    p_organisation_id: organisationId, p_user_id: userId, p_quote_id: quoteId,
  });
}

export async function convertProspectToLead(supabase: SupabaseClient, organisationId: string, userId: string, prospectId: string) {
  await assertCanConvertProspect(supabase, organisationId, prospectId);
  return rpc<Lead>(supabase, 'op_convert_prospect', {
    p_organisation_id: organisationId, p_user_id: userId, p_prospect_id: prospectId,
  });
}
