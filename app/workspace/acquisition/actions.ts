'use server';

import { createHash, randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { prospectInputSchema } from '@/lib/validation/prospects';
import { createProspect } from '@/lib/repositories/prospects';
import { getCompanyById } from '@/lib/repositories/companies';
import { getContactById } from '@/lib/repositories/contacts';
import { recordActivity } from '@/lib/repositories/activity';
import { convertProspectToLead } from '@/lib/orchestration/service';
import { cancelEntityReminders, queueNotification, scheduleLeadNurture } from '@/lib/notifications/queue';
import { assertCanInviteTechnicalIntake, assertCanQualifyProspect } from '@/lib/business/invariants';
import type { ActionResult, Lead, Prospect } from '@/types/domain';

function siteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://overflow-partner.vercel.app';
  return `${base.startsWith('http') ? base : `https://${base}`}${path}`;
}
function acquisitionUrl(prospectId:string, params:Record<string,string>={}) {
  const query=new URLSearchParams(params);
  return `/workspace/acquisition/${prospectId}${query.size?`?${query.toString()}`:''}`;
}

export async function createProspectAction(formData: FormData): Promise<ActionResult<Prospect>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const raw = Object.fromEntries(formData.entries());
    const companyId = String(raw.company_id || '');
    if (!companyId) return { ok: false, error: 'Select a company.' };
    const company = await getCompanyById(supabase, organisationId, companyId);
    const contactId = String(raw.contact_id || '');
    const contact = contactId ? await getContactById(supabase, organisationId, contactId) : null;
    if (contact?.company_id && contact.company_id !== company.id) return { ok: false, error: 'The selected contact does not belong to the selected company.' };
    const parsed = prospectInputSchema.safeParse({ ...raw, company_id: company.id, company_name: company.name, contact_id: contact?.id || '', contact_name: contact?.full_name || '', job_title: contact?.job_title || '', linkedin_url: contact?.linkedin_url || '', email: contact?.email || '', phone: contact?.phone || '', industry: company.industry || '' });
    if (!parsed.success) return { ok: false, error: 'Please correct the highlighted prospect details.', fieldErrors: parsed.error.flatten().fieldErrors };
    const prospect = await createProspect(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, { organisationId, entityType: 'prospect', entityId: prospect.id, userId: user.id, eventType: 'prospect.created', newValue: prospect });

    if (parsed.data.email) {
      const actionUrl = siteUrl('/');
      await queueNotification(supabase, {
        organisationId, eventKey: 'prospect.received', recipientEmail: parsed.data.email,
        recipientName: parsed.data.contact_name || null, subject: 'We have received your engineering enquiry',
        templateKey: 'enquiry_acknowledgement', payload: { name: parsed.data.contact_name, company: parsed.data.company_name, actionUrl },
        entityType: 'prospect', entityId: prospect.id, idempotencyKey: `prospect:ack:${prospect.id}`,
      }).catch(() => null);
      await scheduleLeadNurture(supabase, {
        organisationId, leadId: prospect.id, email: parsed.data.email, name: parsed.data.contact_name,
        company: parsed.data.company_name, actionUrl,
      }).catch(() => 0);
    }

    revalidatePath('/workspace/acquisition'); revalidatePath(`/workspace/companies/${company.id}`); revalidatePath('/workspace');
    return { ok: true, data: prospect };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to create prospect.' }; }
}

export async function createProspectFormAction(formData: FormData) {
  const result = await createProspectAction(formData);
  redirect(result.ok
    ? acquisitionUrl(result.data.id,{created:'Prospect added',focus:'record-next-action'})
    : `/workspace/acquisition?error=${encodeURIComponent(result.error)}&focus=manual-prospect`);
}

export async function createStep2InvitationFormAction(formData: FormData) {
  const prospectId = String(formData.get('prospect_id') || '');
  let destination = prospectId ? acquisitionUrl(prospectId) : '/workspace/acquisition';
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    if (!prospectId) throw new Error('Prospect ID is required.');
    await assertCanInviteTechnicalIntake(supabase, organisationId, prospectId);
    const { data: prospect, error: prospectError } = await supabase.from('prospects').select('id,status,email,contact_name,company_name').eq('organisation_id', organisationId).eq('id', prospectId).single();
    if (prospectError || !prospect) throw new Error('Prospect not found.');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const { data: session, error } = await supabase.from('intake_sessions').insert({ organisation_id: organisationId, prospect_id: prospectId, token_hash: tokenHash, status: 'invited', expires_at: expiresAt, sent_at: now, created_by: user.id }).select('id').single();
    if (error) throw error;
    await supabase.from('prospects').update({ next_action: 'Await customer technical intake' }).eq('organisation_id', organisationId).eq('id', prospectId);
    await supabase.from('activity_events').insert({ organisation_id: organisationId, user_id: user.id, entity_type: 'prospect', entity_id: prospectId, event_type: 'technical_intake_invited', event_data: { intakeSessionId: session.id, expiresAt, delivery: prospect.email ? 'queued_for_email' : 'link_ready', invariant:'ACTIVE_PROSPECT_INTAKE' } });
    const url = siteUrl(`/intake/${token}`);

    await cancelEntityReminders(supabase, { organisationId, entityType: 'prospect', entityId: prospectId, categories: ['nurture'] }).catch(() => 0);
    if (prospect.email) {
      const payload = { name: prospect.contact_name, company: prospect.company_name, dueDate: new Date(expiresAt).toLocaleDateString('en-GB'), actionUrl: url };
      await queueNotification(supabase,{organisationId,eventKey:'client.intake_requested',recipientEmail:prospect.email,recipientName:prospect.contact_name,subject:'Please complete your secure technical intake',templateKey:'technical_intake_invitation',payload,entityType:'prospect',entityId:prospectId,idempotencyKey:`intake:invite:${session.id}`}).catch(()=>null);
      await queueNotification(supabase,{organisationId,eventKey:'client.intake_reminder.24h',recipientEmail:prospect.email,recipientName:prospect.contact_name,subject:'A polite reminder about your technical intake',templateKey:'technical_intake_reminder',payload,entityType:'prospect',entityId:prospectId,category:'reminder',scheduledFor:new Date(Date.now()+24*60*60*1000).toISOString(),idempotencyKey:`intake:reminder:24h:${session.id}`}).catch(()=>null);
      await queueNotification(supabase,{organisationId,eventKey:'client.intake_reminder.72h',recipientEmail:prospect.email,recipientName:prospect.contact_name,subject:'Your technical intake remains available',templateKey:'technical_intake_reminder',payload,entityType:'prospect',entityId:prospectId,category:'reminder',scheduledFor:new Date(Date.now()+72*60*60*1000).toISOString(),idempotencyKey:`intake:reminder:72h:${session.id}`}).catch(()=>null);
      await queueNotification(supabase,{organisationId,eventKey:'client.intake_reminder.expiry',recipientEmail:prospect.email,recipientName:prospect.contact_name,subject:'Technical intake link expiry reminder',templateKey:'technical_intake_reminder',payload,entityType:'prospect',entityId:prospectId,category:'reminder',scheduledFor:new Date(Date.now()+6*24*60*60*1000).toISOString(),idempotencyKey:`intake:reminder:expiry:${session.id}`}).catch(()=>null);
    }

    revalidatePath(`/workspace/acquisition/${prospectId}`); revalidatePath('/workspace/acquisition'); revalidatePath('/workspace');
    destination = acquisitionUrl(prospectId,{invitation:url,focus:'record-next-action'});
  } catch (error) {
    const text=error instanceof Error ? error.message : 'Unable to create Technical Intake invitation.';
    destination = prospectId
      ? acquisitionUrl(prospectId,{error:text,focus:'record-next-action'})
      : `/workspace/acquisition?error=${encodeURIComponent(text)}`;
  }
  redirect(destination);
}

export async function qualifyProspectFormAction(formData: FormData) {
  const prospectId = String(formData.get('prospect_id') || '');
  let destination = prospectId ? acquisitionUrl(prospectId) : '/workspace/acquisition';
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    if (!prospectId) throw new Error('Prospect ID is required.');
    const { prospect, session, review } = await assertCanQualifyProspect(supabase, organisationId, prospectId);
    if (prospect.status === 'qualified') { destination = acquisitionUrl(prospectId,{qualified:'1',focus:'record-next-action'}); }
    else {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase.from('prospects').update({ status: 'qualified', next_action: 'Create governed Case 360', assigned_to: user.id, updated_at: now }).eq('organisation_id', organisationId).eq('id', prospectId);
      if (updateError) throw updateError;
      await supabase.from('activity_events').insert({ organisation_id: organisationId, user_id: user.id, entity_type: 'prospect', entity_id: prospectId, event_type: 'prospect_qualified', event_data: { intakeSessionId: session.id, technicalReviewId: review.id, qualifiedAt: now, previousStatus: prospect.status, invariant:'TECHNICAL_REVIEW_REQUIRED' } });
      await cancelEntityReminders(supabase,{organisationId,entityType:'prospect',entityId:prospectId}).catch(()=>0);
      revalidatePath(`/workspace/acquisition/${prospectId}`); revalidatePath('/workspace/acquisition'); revalidatePath('/workspace'); destination = acquisitionUrl(prospectId,{qualified:'1',focus:'record-next-action'});
    }
  } catch (error) {
    const text=error instanceof Error ? error.message : 'Unable to qualify prospect.';
    destination = prospectId ? acquisitionUrl(prospectId,{error:text,focus:'record-next-action'}) : `/workspace/acquisition?error=${encodeURIComponent(text)}`;
  }
  redirect(destination);
}

export async function convertProspectAction(formData: FormData): Promise<ActionResult<Lead>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const prospectId = String(formData.get('prospect_id') || '');
    if (!prospectId) return { ok: false, error: 'Prospect ID is required.' };
    const lead = await convertProspectToLead(supabase, organisationId, user.id, prospectId);
    await cancelEntityReminders(supabase,{organisationId,entityType:'prospect',entityId:prospectId}).catch(()=>0);
    revalidatePath(`/workspace/acquisition/${prospectId}`); revalidatePath('/workspace/acquisition'); revalidatePath('/workspace/leads'); revalidatePath('/workspace/orchestration'); revalidatePath('/workspace');
    return { ok: true, data: lead };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to convert prospect.' }; }
}

export async function convertProspectFormAction(formData: FormData) {
  const prospectId=String(formData.get('prospect_id')||'');
  const result = await convertProspectAction(formData);
  redirect(result.ok
    ? `/workspace/leads/${result.data.id}?success=${encodeURIComponent('Prospect converted. Case 360 now owns this opportunity.')}&focus=record-next-action`
    : prospectId
      ? acquisitionUrl(prospectId,{error:result.error,focus:'record-next-action'})
      : `/workspace/acquisition?error=${encodeURIComponent(result.error)}`);
}
