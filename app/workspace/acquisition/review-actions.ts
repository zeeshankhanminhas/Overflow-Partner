'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

function text(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim();
}

export async function submitTechnicalPartnerReviewFormAction(formData: FormData) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);

    const prospectId = text(formData, 'prospect_id');
    const intakeSessionId = text(formData, 'intake_session_id');
    const partnerId = text(formData, 'partner_id');
    const decision = text(formData, 'decision');
    const confidencePercent = Number(text(formData, 'confidence_percent'));
    const estimatedHoursRaw = text(formData, 'estimated_hours');
    const leadTimeRaw = text(formData, 'estimated_lead_time_days');
    const pricingReady = text(formData, 'pricing_ready') === 'true';

    if (!prospectId || !intakeSessionId || !partnerId) throw new Error('Prospect, intake session and technical partner are required.');
    if (!['feasible', 'feasible_with_clarification', 'not_feasible'].includes(decision)) throw new Error('Select a valid technical decision.');
    if (!Number.isInteger(confidencePercent) || confidencePercent < 0 || confidencePercent > 100) throw new Error('Confidence must be between 0 and 100.');

    const [{ data: session, error: sessionError }, { data: partner, error: partnerError }] = await Promise.all([
      supabase.from('intake_sessions').select('id,status,prospect_id').eq('organisation_id', organisationId).eq('id', intakeSessionId).eq('prospect_id', prospectId).single(),
      supabase.from('partners').select('id,status,nda_signed,company_name').eq('organisation_id', organisationId).eq('id', partnerId).single(),
    ]);
    if (sessionError || !session || session.status !== 'submitted') throw new Error('A submitted Step 2 intake is required for technical review.');
    if (partnerError || !partner) throw new Error('Technical partner not found.');
    if (partner.status !== 'approved' || !partner.nda_signed) throw new Error('Only an approved, NDA-compliant partner can complete the technical review.');

    const status = decision === 'not_feasible' ? 'rejected' : 'approved';
    const now = new Date().toISOString();
    const { data: review, error } = await supabase.from('prospect_technical_reviews').insert({
      organisation_id: organisationId,
      prospect_id: prospectId,
      intake_session_id: intakeSessionId,
      partner_id: partnerId,
      reviewed_by: user.id,
      decision,
      status,
      confidence_percent: confidencePercent,
      estimated_hours: estimatedHoursRaw ? Number(estimatedHoursRaw) : null,
      estimated_lead_time_days: leadTimeRaw ? Number(leadTimeRaw) : null,
      pricing_ready: pricingReady,
      missing_information: text(formData, 'missing_information') || null,
      technical_risks: text(formData, 'technical_risks') || null,
      assumptions: text(formData, 'assumptions') || null,
      review_notes: text(formData, 'review_notes') || null,
      approved_at: status === 'approved' ? now : null,
      updated_at: now,
    }).select('id').single();
    if (error) throw error;

    await supabase.from('prospects').update({
      next_action: status === 'approved'
        ? 'Complete commercial qualification decision'
        : 'Resolve technical feasibility before commercial qualification',
      updated_at: now,
    }).eq('organisation_id', organisationId).eq('id', prospectId);

    await supabase.from('activity_events').insert({
      organisation_id: organisationId,
      user_id: user.id,
      entity_type: 'prospect',
      entity_id: prospectId,
      event_type: status === 'approved' ? 'technical_partner_review_approved' : 'technical_partner_review_rejected',
      event_data: { reviewId: review.id, intakeSessionId, partnerId, partnerName: partner.company_name, decision, confidencePercent, pricingReady },
    });

    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace');
    redirect(`/workspace/acquisition?technical_review=${status}`);
  } catch (error) {
    redirect(`/workspace/acquisition?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to record technical partner review.')}`);
  }
}

export async function qualifyAfterTechnicalReviewFormAction(formData: FormData) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const prospectId = text(formData, 'prospect_id');
    if (!prospectId) throw new Error('Prospect ID is required.');

    const [{ data: prospect, error: prospectError }, { data: review, error: reviewError }] = await Promise.all([
      supabase.from('prospects').select('id,status,company_name,project_type,requirement_summary').eq('organisation_id', organisationId).eq('id', prospectId).single(),
      supabase.from('prospect_technical_reviews').select('id,decision,status,partner_id,confidence_percent,pricing_ready').eq('organisation_id', organisationId).eq('prospect_id', prospectId).eq('status', 'approved').in('decision', ['feasible','feasible_with_clarification']).order('approved_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (prospectError || !prospect) throw new Error('Prospect not found.');
    if (reviewError) throw reviewError;
    if (!review) throw new Error('An approved feasible technical partner review is required before commercial qualification.');
    if (!prospect.company_name?.trim() || !prospect.project_type?.trim() || !prospect.requirement_summary?.trim()) throw new Error('Company, project type and requirement summary are required before qualification.');
    if (prospect.status === 'converted') throw new Error('This prospect has already been converted.');

    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from('prospects').update({
      status: 'qualified',
      next_action: 'Convert qualified prospect to governed lead',
      assigned_to: user.id,
      updated_at: now,
    }).eq('organisation_id', organisationId).eq('id', prospectId);
    if (updateError) throw updateError;

    await supabase.from('activity_events').insert({
      organisation_id: organisationId,
      user_id: user.id,
      entity_type: 'prospect',
      entity_id: prospectId,
      event_type: 'commercial_qualification_approved',
      event_data: { technicalReviewId: review.id, partnerId: review.partner_id, technicalConfidence: review.confidence_percent, pricingReady: review.pricing_ready, qualifiedAt: now, previousStatus: prospect.status },
    });

    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace');
    redirect('/workspace/acquisition?qualified=1');
  } catch (error) {
    redirect(`/workspace/acquisition?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to qualify prospect.')}`);
  }
}
