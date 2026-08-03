import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClientQuote,
  CommercialReview,
  Lead,
  PartnerQuote,
  Project,
  TechnicalIntake,
} from '@/types/domain';
import type { WorkflowCase, WorkflowStage } from '@/types/orchestration';

function compactReference(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${date}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function recordActivity(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  entityType: string,
  entityId: string,
  eventType: string,
  eventData: Record<string, unknown>,
) {
  const { error } = await supabase.from('activity_events').insert({
    organisation_id: organisationId,
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    event_data: eventData,
  });
  if (error) throw new Error(error.message);
}

function deriveStage(
  intake: TechnicalIntake | null,
  partnerQuote: PartnerQuote | null,
  commercialReview: CommercialReview | null,
  clientQuote: ClientQuote | null,
  project: Project | null,
): { stage: WorkflowStage; nextAction: string } {
  if (project) return { stage: 'project', nextAction: 'Manage delivery and controlled documents' };
  if (clientQuote) return { stage: 'client_quote', nextAction: clientQuote.status === 'accepted' ? 'Create project' : 'Issue or accept client quote' };
  if (commercialReview) return { stage: 'commercial_review', nextAction: commercialReview.status === 'approved' ? 'Generate client quote' : 'Approve commercial review' };
  if (partnerQuote) return { stage: 'partner_pricing', nextAction: 'Create commercial review from selected partner price' };
  if (intake) return { stage: 'technical_intake', nextAction: intake.status === 'approved' ? 'Select partner pricing' : 'Complete and approve technical intake' };
  return { stage: 'lead', nextAction: 'Create inherited technical intake' };
}

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

  const leads = (leadsResult.data ?? []) as Lead[];
  const intakes = (intakesResult.data ?? []) as TechnicalIntake[];
  const partnerQuotes = (partnerQuotesResult.data ?? []) as PartnerQuote[];
  const reviews = (reviewsResult.data ?? []) as CommercialReview[];
  const quotes = (quotesResult.data ?? []) as ClientQuote[];
  const projects = (projectsResult.data ?? []) as Project[];

  return leads.map((lead) => {
    const technicalIntake = intakes.find((item) => item.lead_id === lead.id) ?? null;
    const partnerQuote = partnerQuotes.find((item) => item.lead_id === lead.id && item.status === 'selected')
      ?? partnerQuotes.find((item) => item.lead_id === lead.id && item.status === 'received')
      ?? null;
    const commercialReview = reviews.find((item) => item.lead_id === lead.id) ?? null;
    const clientQuote = quotes.find((item) => item.lead_id === lead.id) ?? null;
    const project = projects.find((item) => item.lead_id === lead.id) ?? null;
    const progress = deriveStage(technicalIntake, partnerQuote, commercialReview, clientQuote, project);

    return { lead, technicalIntake, partnerQuote, commercialReview, clientQuote, project, ...progress };
  });
}

export async function ensureTechnicalIntakeShell(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  leadId: string,
) {
  const { data: existing, error: existingError } = await supabase
    .from('technical_intakes')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('lead_id', leadId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as TechnicalIntake;

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('id', leadId)
    .single();
  if (leadError) throw new Error(leadError.message);

  const { data, error } = await supabase.from('technical_intakes').insert({
    organisation_id: organisationId,
    lead_id: lead.id,
    project_type: lead.project_type,
    description: lead.notes || lead.title || `${lead.company_name} engineering requirement`,
    deliverables: lead.service,
    status: 'draft',
    created_by: userId,
  }).select('*').single();
  if (error) throw new Error(error.message);

  await supabase.from('leads').update({ status: 'technical_intake' }).eq('organisation_id', organisationId).eq('id', leadId);
  await recordActivity(supabase, organisationId, userId, 'lead', leadId, 'technical_intake_shell_created', { inherited: true });
  return data as TechnicalIntake;
}

export async function approveTechnicalIntake(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  intakeId: string,
) {
  const now = new Date().toISOString();
  const { data: intake, error } = await supabase.from('technical_intakes').update({
    status: 'approved',
    reviewed_by: userId,
    reviewed_at: now,
  }).eq('organisation_id', organisationId).eq('id', intakeId).select('*').single();
  if (error) throw new Error(error.message);

  await supabase.from('leads').update({ status: 'partner_review' }).eq('organisation_id', organisationId).eq('id', intake.lead_id);

  const { data: existingTask } = await supabase.from('tasks').select('id').eq('organisation_id', organisationId)
    .eq('entity_type', 'lead').eq('entity_id', intake.lead_id).eq('title', 'Select partner and obtain pricing').maybeSingle();
  if (!existingTask) {
    await supabase.from('tasks').insert({
      organisation_id: organisationId,
      created_by: userId,
      assigned_to: userId,
      entity_type: 'lead',
      entity_id: intake.lead_id,
      title: 'Select partner and obtain pricing',
      description: 'Technical intake approved. Choose a suitable approved partner and capture their price.',
      priority: 'high',
      status: 'open',
    });
  }

  await recordActivity(supabase, organisationId, userId, 'technical_intake', intakeId, 'technical_intake_approved', { leadId: intake.lead_id });
  return intake as TechnicalIntake;
}

export async function createCommercialReviewFromPartnerQuote(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  partnerQuoteId: string,
  markupPercent: number,
) {
  const { data: partnerQuote, error: quoteError } = await supabase.from('partner_quotes').select('*')
    .eq('organisation_id', organisationId).eq('id', partnerQuoteId).single();
  if (quoteError) throw new Error(quoteError.message);

  const { data: existing } = await supabase.from('commercial_reviews').select('*')
    .eq('organisation_id', organisationId).eq('partner_quote_id', partnerQuoteId).maybeSingle();
  if (existing) return existing as CommercialReview;

  const costPrice = Number(partnerQuote.price);
  const clientPrice = Number((costPrice * (1 + markupPercent / 100)).toFixed(2));
  const marginAmount = Number((clientPrice - costPrice).toFixed(2));
  const marginPercent = clientPrice > 0 ? Number(((marginAmount / clientPrice) * 100).toFixed(2)) : 0;

  const { data, error } = await supabase.from('commercial_reviews').insert({
    organisation_id: organisationId,
    created_by: userId,
    lead_id: partnerQuote.lead_id,
    partner_quote_id: partnerQuote.id,
    cost_price: costPrice,
    client_price: clientPrice,
    margin_amount: marginAmount,
    margin_percent: marginPercent,
    status: 'pending_approval',
  }).select('*').single();
  if (error) throw new Error(error.message);

  await supabase.from('partner_quotes').update({ status: 'selected' }).eq('organisation_id', organisationId).eq('id', partnerQuote.id);
  await supabase.from('leads').update({ status: 'pricing' }).eq('organisation_id', organisationId).eq('id', partnerQuote.lead_id);
  await recordActivity(supabase, organisationId, userId, 'commercial_review', data.id, 'commercial_review_generated', { partnerQuoteId, markupPercent });
  return data as CommercialReview;
}

export async function approveCommercialAndGenerateQuote(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  commercialReviewId: string,
) {
  const { data: review, error: reviewError } = await supabase.from('commercial_reviews').select('*')
    .eq('organisation_id', organisationId).eq('id', commercialReviewId).single();
  if (reviewError) throw new Error(reviewError.message);

  const { data: existing } = await supabase.from('quotes').select('*')
    .eq('organisation_id', organisationId).eq('commercial_review_id', commercialReviewId).maybeSingle();
  if (existing) return existing as ClientQuote;

  const now = new Date().toISOString();
  await supabase.from('commercial_reviews').update({ status: 'approved', approved_by: userId, approved_at: now })
    .eq('organisation_id', organisationId).eq('id', commercialReviewId);

  const subtotal = Number(review.client_price);
  const vat = Number((subtotal * 0.2).toFixed(2));
  const { data: quote, error } = await supabase.from('quotes').insert({
    organisation_id: organisationId,
    created_by: userId,
    lead_id: review.lead_id,
    commercial_review_id: review.id,
    quote_number: compactReference('OPQ'),
    revision: 1,
    status: 'draft',
    subtotal,
    vat,
    total: Number((subtotal + vat).toFixed(2)),
    currency: 'GBP',
  }).select('*').single();
  if (error) throw new Error(error.message);

  await supabase.from('leads').update({ status: 'quoted' }).eq('organisation_id', organisationId).eq('id', review.lead_id);
  await supabase.from('documents').insert({
    organisation_id: organisationId,
    lead_id: review.lead_id,
    quote_id: quote.id,
    created_by: userId,
    document_type: 'client_quote',
    reference: quote.quote_number,
    title: `Client Quote ${quote.quote_number}`,
    status: 'draft',
    version: 1,
  });
  await recordActivity(supabase, organisationId, userId, 'quote', quote.id, 'client_quote_generated', { commercialReviewId });
  return quote as ClientQuote;
}

export async function acceptQuoteAndCreateProject(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  quoteId: string,
) {
  const { data: quote, error: quoteError } = await supabase.from('quotes').select('*')
    .eq('organisation_id', organisationId).eq('id', quoteId).single();
  if (quoteError) throw new Error(quoteError.message);

  const { data: existing } = await supabase.from('projects').select('*')
    .eq('organisation_id', organisationId).eq('quote_id', quoteId).maybeSingle();
  if (existing) return existing as Project;

  const { data: lead, error: leadError } = await supabase.from('leads').select('*')
    .eq('organisation_id', organisationId).eq('id', quote.lead_id).single();
  if (leadError) throw new Error(leadError.message);

  const now = new Date().toISOString();
  await supabase.from('quotes').update({ status: 'accepted', accepted_at: now })
    .eq('organisation_id', organisationId).eq('id', quoteId);
  await supabase.from('leads').update({ status: 'won' }).eq('organisation_id', organisationId).eq('id', quote.lead_id);

  const { data: project, error } = await supabase.from('projects').insert({
    organisation_id: organisationId,
    created_by: userId,
    project_manager_id: userId,
    lead_id: quote.lead_id,
    quote_id: quote.id,
    project_number: compactReference('OPP'),
    title: lead.title || `${lead.company_name} engineering project`,
    status: 'planning',
    start_date: new Date().toISOString().slice(0, 10),
    notes: lead.notes,
  }).select('*').single();
  if (error) throw new Error(error.message);

  await supabase.from('documents').insert([
    {
      organisation_id: organisationId,
      lead_id: quote.lead_id,
      project_id: project.id,
      quote_id: quote.id,
      created_by: userId,
      document_type: 'scope_of_work',
      reference: `${project.project_number}-SOW-001`,
      title: `${project.title} — Scope of Work`,
      status: 'draft',
      version: 1,
    },
    {
      organisation_id: organisationId,
      lead_id: quote.lead_id,
      project_id: project.id,
      quote_id: quote.id,
      created_by: userId,
      document_type: 'project_closeout',
      reference: `${project.project_number}-CLS-001`,
      title: `${project.title} — Closeout Pack`,
      status: 'draft',
      version: 1,
    },
  ]);

  await recordActivity(supabase, organisationId, userId, 'project', project.id, 'project_created_from_accepted_quote', { quoteId, inherited: true });
  return project as Project;
}
