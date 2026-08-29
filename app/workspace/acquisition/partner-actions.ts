'use server';

import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { cancelEntityReminders } from '@/lib/notifications/queue';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';

function text(formData: FormData, key: string) { return String(formData.get(key) || '').trim(); }
function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message;
  return fallback;
}
function siteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://overflow-partner.vercel.app';
  return `${base.startsWith('http') ? base : `https://${base}`}${path}`;
}

export async function createProspectPartnerReviewAction(formData: FormData) {
  const prospectId = text(formData, 'prospect_id');
  let destination = prospectId ? `/workspace/acquisition/${prospectId}` : '/workspace/acquisition';
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner','admin','business_development','operator','engineering']);
    const intakeSessionId = text(formData, 'intake_session_id');
    const partnerId = text(formData, 'partner_id');
    const responseDueAt = text(formData, 'response_due_at');
    const scopeSummary = text(formData, 'scope_summary');
    if (!prospectId || !intakeSessionId || !partnerId || !responseDueAt || !scopeSummary) throw new Error('Prospect, submitted intake, partner, due date and scope summary are required.');

    const [{ data: prospect, error: prospectError }, { data: partner, error: partnerError }] = await Promise.all([
      supabase.from('prospects').select('id,company_name,project_type').eq('organisation_id',organisationId).eq('id',prospectId).single(),
      supabase.from('partners').select('id,company_name,contact_name,email,status,nda_signed').eq('organisation_id',organisationId).eq('id',partnerId).single(),
    ]);
    if (prospectError || !prospect) throw prospectError || new Error('Prospect not found.');
    if (partnerError) throw partnerError;
    if (!partner || partner.status !== 'approved' || !partner.nda_signed) throw new Error('Select an approved NDA-compliant partner.');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const due = new Date(responseDueAt);
    if (Number.isNaN(due.getTime())) throw new Error('Enter a valid partner response due date.');
    const expiresAt = new Date(Math.max(due.getTime(), Date.now()) + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: request, error } = await supabase.rpc('op_create_prospect_partner_review_request', {
      p_organisation_id:organisationId,p_user_id:user.id,p_prospect_id:prospectId,p_intake_session_id:intakeSessionId,p_partner_id:partnerId,
      p_token_hash:tokenHash,p_response_due_at:due.toISOString(),p_expires_at:expiresAt,p_review_instructions:text(formData,'review_instructions')||null,
      p_scope_summary:scopeSummary,p_show_client_identity:formData.get('show_client_identity')==='true',
    });
    if (error) throw error;

    const reviewUrl = siteUrl(`/partner-review/${token}`);
    const requestId = String(request?.id || '');
    let notificationWarning = '';
    if (partner.email) {
      const payload={company:partner.company_name,project:`${prospect.company_name} — ${prospect.project_type||'Engineering requirement'}`,reference:request?.case_reference||requestId,dueDate:due.toLocaleDateString('en-GB')};
      try {
        await queueLifecycleEmail(supabase,{organisationId,scenario:'partner_review.requested',recipientEmail:partner.email,recipientName:partner.contact_name||partner.company_name,actionUrl:reviewUrl,payload,entityType:'prospect',entityId:prospectId,idempotencyKey:`prospect-partner-review:requested:${requestId}`,subject:`Delivery review requested — ${prospect.company_name}`});
        await queueLifecycleEmail(supabase,{organisationId,scenario:'partner_review.reminder',recipientEmail:partner.email,recipientName:partner.contact_name||partner.company_name,actionUrl:reviewUrl,payload,entityType:'prospect',entityId:prospectId,scheduledFor:new Date(Math.max(Date.now(),due.getTime()-48*60*60*1000)).toISOString(),idempotencyKey:`prospect-partner-review:reminder:${requestId}`,subject:`Reminder: delivery review due — ${prospect.company_name}`});
      } catch (notificationError) {
        console.error('Partner review notification queue failed after request creation', notificationError);
        notificationWarning = '&notificationWarning=1';
      }
    }

    revalidatePath(`/workspace/acquisition/${prospectId}`); revalidatePath('/workspace/acquisition'); revalidatePath('/workspace'); revalidatePath('/workspace/notifications');
    destination = `/workspace/acquisition/${prospectId}?partnerReviewCreated=1&reviewUrl=${encodeURIComponent(reviewUrl)}${notificationWarning}`;
  } catch (error) {
    console.error('Prospect partner review request failed', error);
    destination = `${destination}?error=${encodeURIComponent(errorMessage(error, 'Unable to request partner review.'))}`;
  }
  redirect(destination);
}

export async function decideProspectPartnerReviewAction(formData: FormData) {
  const prospectId = text(formData,'prospect_id');
  let destination = prospectId ? `/workspace/acquisition/${prospectId}` : '/workspace/acquisition';
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner','admin','commercial','engineering']);
    const decision = text(formData,'decision');
    const requestId = text(formData,'request_id');
    const responseId = text(formData,'response_id');
    const clarificationRequest=text(formData,'clarification_request');
    if (!prospectId || !requestId || !responseId) throw new Error('Partner response context is incomplete.');

    const {data:request}=await supabase.from('prospect_partner_review_requests').select('partner_id').eq('organisation_id',organisationId).eq('id',requestId).maybeSingle();
    const { error } = await supabase.rpc('op_decide_prospect_partner_review', {
      p_organisation_id:organisationId,p_user_id:user.id,p_prospect_id:prospectId,p_request_id:requestId,p_response_id:responseId,p_decision:decision,
      p_review_notes:text(formData,'review_notes')||null,p_accepted_assumptions:text(formData,'accepted_assumptions')||null,p_accepted_risks:text(formData,'accepted_risks')||null,p_clarification_request:clarificationRequest||null,
    });
    if (error) throw error;

    await cancelEntityReminders(supabase,{organisationId,entityType:'prospect',entityId:prospectId,categories:['reminder']}).catch(()=>0);
    if(clarificationRequest && request?.partner_id){
      const {data:partner}=await supabase.from('partners').select('company_name,contact_name,email').eq('organisation_id',organisationId).eq('id',request.partner_id).maybeSingle();
      if(partner?.email) await queueLifecycleEmail(supabase,{organisationId,scenario:'partner_review.clarification',recipientEmail:partner.email,recipientName:partner.contact_name||partner.company_name,actionUrl:siteUrl('/'),payload:{message:clarificationRequest},entityType:'prospect',entityId:prospectId,idempotencyKey:`partner-review:clarification:${responseId}`}).catch(()=>null);
    }
    revalidatePath(`/workspace/acquisition/${prospectId}`); revalidatePath('/workspace/acquisition'); revalidatePath('/workspace'); revalidatePath('/workspace/notifications');
    destination = `/workspace/acquisition/${prospectId}?partnerDecision=${encodeURIComponent(decision)}`;
  } catch (error) {
    console.error('Prospect partner review decision failed', error);
    destination = `${destination}?error=${encodeURIComponent(errorMessage(error, 'Unable to record partner decision.'))}`;
  }
  redirect(destination);
}
