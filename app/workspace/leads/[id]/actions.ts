'use server';

import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';

const internalRoles = ['owner', 'admin', 'operator', 'engineering', 'commercial', 'business_development'] as const;

function text(formData: FormData, name: string) {
  return String(formData.get(name) || '').trim();
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

export async function createPartnerReviewRequestAction(formData: FormData) {
  const leadId = text(formData, 'lead_id');
  let destination = `/workspace/leads/${leadId}`;

  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...internalRoles]);
    const technicalIntakeId = text(formData, 'technical_intake_id');
    const partnerId = text(formData, 'partner_id');
    const responseDueAt = text(formData, 'response_due_at');
    const scopeSummary = text(formData, 'scope_summary');
    if (!leadId || !technicalIntakeId || !partnerId || !responseDueAt || !scopeSummary) throw new Error('Lead, approved scope, partner, response due date and scope summary are required.');

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const dueTime = new Date(responseDueAt).getTime();
    if (Number.isNaN(dueTime)) throw new Error('A valid response due date is required.');
    const expiresAt = new Date(Math.max(dueTime, Date.now()) + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase.rpc('op_create_partner_review_request', {
      p_organisation_id: organisationId,
      p_user_id: user.id,
      p_lead_id: leadId,
      p_technical_intake_id: technicalIntakeId,
      p_partner_id: partnerId,
      p_token_hash: tokenHash,
      p_response_due_at: new Date(responseDueAt).toISOString(),
      p_expires_at: expiresAt,
      p_review_instructions: text(formData, 'review_instructions') || null,
      p_scope_summary: scopeSummary,
      p_show_client_identity: formData.get('show_client_identity') === 'true',
      p_show_commercial_identity: formData.get('show_commercial_identity') === 'true',
    });
    if (error) throw error;

    const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://overflow-partner.vercel.app';
    const origin = base.startsWith('http') ? base : `https://${base}`;
    const reviewUrl = `${origin}/partner-review/${rawToken}`;
    const requestId = typeof data === 'string' ? data : String(data?.id || '');
    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath('/workspace/partner-quotes');
    destination = `/workspace/leads/${leadId}?partnerReviewCreated=1&reviewUrl=${encodeURIComponent(reviewUrl)}&requestId=${encodeURIComponent(requestId)}`;
  } catch (error) {
    console.error('Partner review request creation failed', error);
    destination = `/workspace/leads/${leadId}?error=${encodeURIComponent(errorMessage(error, 'Unable to create partner review request.'))}`;
  }

  redirect(destination);
}

export async function decidePartnerReviewAction(formData: FormData) {
  const leadId = text(formData, 'lead_id');
  let destination = `/workspace/leads/${leadId}`;

  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...internalRoles]);
    const { error } = await supabase.rpc('op_decide_partner_review', {
      p_organisation_id: organisationId,
      p_user_id: user.id,
      p_request_id: text(formData, 'request_id'),
      p_response_id: text(formData, 'response_id'),
      p_decision: text(formData, 'decision'),
      p_review_notes: text(formData, 'review_notes') || null,
      p_accepted_assumptions: text(formData, 'accepted_assumptions') || null,
      p_accepted_risks: text(formData, 'accepted_risks') || null,
      p_clarification_request: text(formData, 'clarification_request') || null,
    });
    if (error) throw error;
    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath('/workspace/partner-quotes');
    destination = `/workspace/leads/${leadId}?partnerReviewDecision=1`;
  } catch (error) {
    console.error('Partner review decision failed', error);
    destination = `/workspace/leads/${leadId}?error=${encodeURIComponent(errorMessage(error, 'Unable to record partner review decision.'))}`;
  }

  redirect(destination);
}

export async function revokePartnerReviewAction(formData: FormData) {
  const leadId = text(formData, 'lead_id');
  let destination = `/workspace/leads/${leadId}`;

  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, [...internalRoles]);
    const requestId = text(formData, 'request_id');
    const { data: request, error: requestError } = await supabase.from('partner_review_requests').select('id,lead_id,status').eq('organisation_id', organisationId).eq('id', requestId).single();
    if (requestError || !request || request.lead_id !== leadId) throw new Error('Partner review request not found.');
    const now = new Date().toISOString();
    const { error } = await supabase.from('partner_review_requests').update({ status: 'revoked', revoked_at: now, updated_at: now }).eq('id', requestId).eq('organisation_id', organisationId);
    if (error) throw error;
    await supabase.from('activity_events').insert({ organisation_id: organisationId, user_id: user.id, entity_type: 'lead', entity_id: leadId, event_type: 'partner_review_access_revoked', event_data: { partnerReviewRequestId: requestId } });
    revalidatePath(`/workspace/leads/${leadId}`);
    destination = `/workspace/leads/${leadId}?partnerReviewRevoked=1`;
  } catch (error) {
    console.error('Partner review revocation failed', error);
    destination = `/workspace/leads/${leadId}?error=${encodeURIComponent(errorMessage(error, 'Unable to revoke partner review access.'))}`;
  }

  redirect(destination);
}
