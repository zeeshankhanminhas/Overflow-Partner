'use server';

import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { buildLead360Context, buildPartnerReviewScope, inheritedSnapshot } from '@/lib/context/inheritance';
import { cancelEntityReminders, queueNotification } from '@/lib/notifications/queue';
import type { Lead, TechnicalIntake } from '@/types/domain';

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
    if (!leadId || !technicalIntakeId || !partnerId || !responseDueAt) {
      throw new Error('Lead, approved technical scope, partner and response due date are required.');
    }

    const [{ data: lead, error: leadError }, { data: intake, error: intakeError }, { data: partner, error: partnerError }] = await Promise.all([
      supabase.from('leads').select('*').eq('organisation_id', organisationId).eq('id', leadId).single(),
      supabase.from('technical_intakes').select('*').eq('organisation_id', organisationId).eq('id', technicalIntakeId).eq('lead_id', leadId).single(),
      supabase.from('partners').select('id,company_name,contact_name,email,status,nda_signed').eq('organisation_id', organisationId).eq('id', partnerId).single(),
    ]);
    if (leadError || !lead) throw new Error('Lead 360 context could not be loaded.');
    if (intakeError || !intake || intake.status !== 'approved') throw new Error('An approved technical scope is required.');
    if (partnerError || !partner || partner.status !== 'approved' || !partner.nda_signed) throw new Error('An approved NDA-ready execution partner is required.');

    const context = buildLead360Context(lead as Lead, intake as TechnicalIntake);
    const scopeSummary = buildPartnerReviewScope(context);
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

    const requestId = typeof data === 'string' ? data : String(data?.id || '');
    await supabase.from('activity_events').insert({
      organisation_id: organisationId,
      user_id: user.id,
      entity_type: 'lead',
      entity_id: leadId,
      event_type: 'lead_context_inherited_for_partner_review',
      event_data: {
        partnerReviewRequestId: requestId,
        inherited: inheritedSnapshot(context),
        decisionInputs: {
          partnerId,
          responseDueAt: new Date(responseDueAt).toISOString(),
          reviewInstructionsProvided: Boolean(text(formData, 'review_instructions')),
          showClientIdentity: formData.get('show_client_identity') === 'true',
          showCommercialIdentity: formData.get('show_commercial_identity') === 'true',
        },
      },
    });

    const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://overflow-partner.vercel.app';
    const origin = base.startsWith('http') ? base : `https://${base}`;
    const reviewUrl = `${origin}/partner-review/${rawToken}`;

    if (partner.email) {
      const dueAt = new Date(responseDueAt);
      const reminderAt = new Date(Math.max(Date.now(), dueAt.getTime() - 48 * 60 * 60 * 1000));
      const overdueAt = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000);
      const payload = {
        name: partner.contact_name || partner.company_name,
        company: partner.company_name,
        project: lead.title || lead.company_name,
        reference: requestId,
        dueDate: dueAt.toISOString(),
        actionUrl: reviewUrl,
      };
      await queueNotification(supabase, {
        organisationId,
        eventKey: 'partner.review_requested',
        recipientEmail: partner.email,
        recipientName: partner.contact_name || partner.company_name,
        subject: `Technical review requested — ${lead.title || lead.company_name}`,
        templateKey: 'partner_review_requested',
        payload,
        entityType: 'lead',
        entityId: leadId,
        idempotencyKey: `partner-review:requested:${requestId}`,
      });
      await queueNotification(supabase, {
        organisationId,
        eventKey: 'partner.review_reminder',
        recipientEmail: partner.email,
        recipientName: partner.contact_name || partner.company_name,
        subject: `Reminder: technical review due — ${lead.title || lead.company_name}`,
        templateKey: 'partner_review_reminder',
        payload,
        entityType: 'lead',
        entityId: leadId,
        category: 'reminder',
        scheduledFor: reminderAt.toISOString(),
        idempotencyKey: `partner-review:reminder:${requestId}`,
      });
      await queueNotification(supabase, {
        organisationId,
        eventKey: 'partner.review_overdue',
        recipientEmail: partner.email,
        recipientName: partner.contact_name || partner.company_name,
        subject: `Technical review follow-up — ${lead.title || lead.company_name}`,
        templateKey: 'partner_review_reminder',
        payload: { ...payload, overdue: true },
        entityType: 'lead',
        entityId: leadId,
        category: 'reminder',
        scheduledFor: overdueAt.toISOString(),
        idempotencyKey: `partner-review:overdue:${requestId}`,
      });
    }

    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath('/workspace/partner-quotes');
    revalidatePath('/workspace/notifications');
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
    await cancelEntityReminders(supabase, { organisationId, entityType: 'lead', entityId: leadId, categories: ['reminder'] });
    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath('/workspace/partner-quotes');
    revalidatePath('/workspace/notifications');
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
    await cancelEntityReminders(supabase, { organisationId, entityType: 'lead', entityId: leadId, categories: ['reminder'] });
    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath('/workspace/notifications');
    destination = `/workspace/leads/${leadId}?partnerReviewRevoked=1`;
  } catch (error) {
    console.error('Partner review revocation failed', error);
    destination = `/workspace/leads/${leadId}?error=${encodeURIComponent(errorMessage(error, 'Unable to revoke partner review access.'))}`;
  }

  redirect(destination);
}
