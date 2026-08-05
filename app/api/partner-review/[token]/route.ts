import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const responseSchema = z.object({
  feasibility: z.enum(['feasible','feasible_with_conditions','more_information_required','not_feasible']),
  confidence_percent: z.coerce.number().int().min(0).max(100),
  capability_confirmed: z.coerce.boolean(),
  software_capability: z.string().trim().max(1000).optional().default(''),
  capacity_status: z.enum(['available','limited','unavailable']),
  earliest_start_date: z.string().trim().optional().default(''),
  estimated_engineering_hours: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  estimated_lead_time_days: z.union([z.coerce.number().int().min(0), z.literal('')]).optional(),
  pricing_readiness: z.enum(['ready','pending_information','technical_review_only']),
  missing_information: z.string().trim().max(5000).optional().default(''),
  assumptions: z.string().trim().max(5000).optional().default(''),
  technical_risks: z.string().trim().max(5000).optional().default(''),
  proposed_delivery_approach: z.string().trim().max(5000).optional().default(''),
  exclusions: z.string().trim().max(5000).optional().default(''),
  partner_notes: z.string().trim().max(5000).optional().default(''),
  not_feasible_reason: z.string().trim().max(5000).optional().default(''),
  commercial_price: z.union([z.coerce.number().positive(), z.literal('')]).optional(),
  commercial_currency: z.string().trim().length(3).optional().or(z.literal('')),
  commercial_valid_until: z.string().trim().optional().default(''),
  quote_reference: z.string().trim().max(200).optional().default(''),
  payment_terms: z.string().trim().max(2000).optional().default(''),
  delivery_commitment: z.string().trim().max(2000).optional().default(''),
  commercial_assumptions: z.string().trim().max(5000).optional().default(''),
  commercial_exclusions: z.string().trim().max(5000).optional().default(''),
  declaration_checked: z.literal(true),
  reviewer_name: z.string().trim().min(2).max(200),
  reviewer_role: z.string().trim().max(200).optional().default(''),
}).superRefine((value, context) => {
  const feasible = ['feasible','feasible_with_conditions'].includes(value.feasibility);
  if (feasible && (value.estimated_engineering_hours === '' || value.estimated_engineering_hours === undefined || value.estimated_lead_time_days === '' || value.estimated_lead_time_days === undefined)) context.addIssue({ code: 'custom', message: 'Feasible responses require estimated hours and lead time.' });
  if (feasible && (value.commercial_price === '' || value.commercial_price === undefined)) context.addIssue({ code: 'custom', message: 'Feasible responses require a commercial price.' });
  if (feasible && !value.commercial_currency) context.addIssue({ code: 'custom', message: 'Select the commercial currency.' });
  if (value.feasibility === 'feasible_with_conditions' && !value.assumptions) context.addIssue({ code: 'custom', message: 'State the conditions or assumptions.' });
  if (value.feasibility === 'more_information_required' && !value.missing_information) context.addIssue({ code: 'custom', message: 'State the missing information.' });
  if (value.feasibility === 'not_feasible' && !value.not_feasible_reason) context.addIssue({ code: 'custom', message: 'State why the scope is not feasible.' });
});

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function loadRequest(token: string) {
  const supabase = admin();
  const { data: review, error } = await supabase.from('partner_review_requests').select('*').eq('token_hash', hashToken(token)).single();
  if (error || !review) return { supabase, review: null };
  if (review.expires_at && new Date(review.expires_at).getTime() < Date.now() && !['submitted','approved','approved_with_conditions','rejected'].includes(review.status)) {
    await supabase.from('partner_review_requests').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', review.id);
    await supabase.from('activity_events').insert({ organisation_id: review.organisation_id, user_id: review.created_by, entity_type: 'lead', entity_id: review.lead_id, event_type: 'partner_review_token_expired', event_data: { partnerReviewRequestId: review.id } });
    return { supabase, review: null };
  }
  if (['revoked','expired'].includes(review.status)) return { supabase, review: null };
  return { supabase, review };
}

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { supabase, review } = await loadRequest(token);
    if (!review) return NextResponse.json({ message: 'This partner review link is invalid, expired or revoked.' }, { status: 404 });
    const now = new Date().toISOString();
    await supabase.from('partner_review_requests').update({ status: review.status === 'invited' ? 'opened' : review.status, first_opened_at: review.first_opened_at || now, last_opened_at: now, updated_at: now }).eq('id', review.id);
    if (!review.first_opened_at) await supabase.from('activity_events').insert({ organisation_id: review.organisation_id, user_id: review.created_by, entity_type: 'lead', entity_id: review.lead_id, event_type: 'partner_review_invitation_opened', event_data: { partnerReviewRequestId: review.id } });

    const [leadResult, intakeResult, partnerResult, filesResult, responseResult, revisionResult, quoteResult] = await Promise.all([
      supabase.from('leads').select('id,title,company_name,project_type,service,notes').eq('id', review.lead_id).single(),
      supabase.from('technical_intakes').select('*').eq('id', review.technical_intake_id).single(),
      supabase.from('partners').select('id,company_name,nda_signed').eq('id', review.partner_id).single(),
      supabase.from('partner_review_files').select('id,display_name,document_id,intake_file_id,storage_path,access_count').eq('partner_review_request_id', review.id).order('created_at'),
      supabase.from('partner_review_responses').select('*').eq('partner_review_request_id', review.id).order('revision', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('partner_review_revisions').select('revision_number,clarification_request,requested_at,resolved_at').eq('partner_review_request_id', review.id).order('revision_number', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('partner_quotes').select('id,price,currency,valid_until,quote_reference,payment_terms,delivery_commitment,commercial_assumptions,exclusions,status').eq('partner_review_request_id', review.id).maybeSingle(),
    ]);
    const lead = leadResult.data;
    return NextResponse.json({
      review: { id: review.id, case_reference: review.case_reference, status: review.status, response_due_at: review.response_due_at, expires_at: review.expires_at, review_instructions: review.review_instructions, scope_summary: review.scope_summary, client_identity: review.show_client_identity ? lead?.company_name : null },
      lead: { title: lead?.title || 'Controlled engineering review', project_type: lead?.project_type, service: lead?.service },
      technical_intake: intakeResult.data,
      partner: partnerResult.data,
      files: filesResult.data || [],
      latest_response: responseResult.data,
      commercial_response: quoteResult.data,
      clarification: revisionResult.data,
    });
  } catch (error) {
    console.error('Partner review load failed', error);
    return NextResponse.json({ message: 'Unable to load this partner review.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const payload = responseSchema.parse(await request.json());
    const { supabase, review } = await loadRequest(token);
    if (!review) return NextResponse.json({ message: 'This partner review link is invalid, expired or revoked.' }, { status: 404 });
    if (['submitted','approved','approved_with_conditions','rejected'].includes(review.status)) return NextResponse.json({ message: 'This review response is locked. A formal clarification cycle is required for revision.' }, { status: 409 });
    const { data, error } = await supabase.rpc('op_submit_partner_review_response', { p_token_hash: hashToken(token), p_payload: payload });
    if (error) throw error;
    return NextResponse.json({ success: true, response: data?.technical_response || data, commercial_response: data?.commercial_response || null });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: error.issues[0]?.message || 'Please check the partner response.' }, { status: 400 });
    console.error('Partner review submission failed', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unable to submit the partner response.' }, { status: 500 });
  }
}
