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
import { cancelEntityReminders } from '@/lib/notifications/queue';
import { queueLifecycleEmail } from '@/lib/notifications/scenarios';
import { scheduleInitialEnquiryNurture } from '@/lib/notifications/schedules';
import { assertCanInviteTechnicalIntake } from '@/lib/business/invariants';
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
      await queueLifecycleEmail(supabase, {
        organisationId, scenario:'enquiry.received', recipientEmail:parsed.data.email,
        recipientName:parsed.data.contact_name || null, actionUrl,
        payload:{company:parsed.data.company_name}, entityType:'prospect', entityId:prospect.id,
        idempotencyKey:`prospect:ack:${prospect.id}`,
      }).catch(()=>null);
      await scheduleInitialEnquiryNurture(supabase, {
        organisationId, prospectId:prospect.id, email:parsed.data.email, name:parsed.data.contact_name,
        company:parsed.data.company_name, actionUrl,
      }).catch(()=>0);
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
      const payload={company:prospect.company_name,dueDate:new Date(expiresAt).toLocaleDateString('en-GB')};
      await queueLifecycleEmail(supabase,{organisationId,scenario:'requirements.requested',recipientEmail:prospect.email,recipientName:prospect.contact_name,actionUrl:url,payload,entityType:'prospect',entityId:prospectId,idempotencyKey:`intake:invite:${session.id}`}).catch(()=>null);
      await queueLifecycleEmail(supabase,{organisationId,scenario:'requirements.reminder',recipientEmail:prospect.email,recipientName:prospect.contact_name,actionUrl:url,payload,entityType:'prospect',entityId:prospectId,scheduledFor:new Date(Date.now()+24*60*60*1000).toISOString(),idempotencyKey:`intake:reminder:24h:${session.id}`}).catch(()=>null);
      await queueLifecycleEmail(supabase,{organisationId,scenario:'requirements.reminder',recipientEmail:prospect.email,recipientName:prospect.contact_name,actionUrl:url,payload,entityType:'prospect',entityId:prospectId,scheduledFor:new Date(Date.now()+72*60*60*1000).toISOString(),idempotencyKey:`intake:reminder:72h:${session.id}`,subject:'Your secure requirements form remains available'}).catch(()=>null);
      await queueLifecycleEmail(supabase,{organisationId,scenario:'requirements.reminder',recipientEmail:prospect.email,recipientName:prospect.contact_name,actionUrl:url,payload,entityType:'prospect',entityId:prospectId,scheduledFor:new Date(Date.now()+6*24*60*60*1000).toISOString(),idempotencyKey:`intake:reminder:expiry:${session.id}`,subject:'Your secure requirements form expires soon'}).catch(()=>null);
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
  const destination = prospectId ? acquisitionUrl(prospectId) : '/workspace/acquisition';
  redirect(`${destination}${destination.includes('?') ? '&' : '?'}error=${encodeURIComponent('Qualification is controlled by the governed Partner Review Go / No-Go decision. Review the partner response instead.')}&focus=record-next-action`);
}

const manuallyEditableProspectStatuses = new Set(['identified','contacted','conversation','not_a_fit']);

export async function updateProspectWorkingStatusFormAction(formData: FormData) {
  const prospectId = String(formData.get('prospect_id') || '').trim();
  const targetStatus = String(formData.get('status') || '').trim();
  const reason = String(formData.get('reason') || '').trim();
  let destination = prospectId ? acquisitionUrl(prospectId) : '/workspace/acquisition';

  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    if (!prospectId) throw new Error('Prospect ID is required.');
    if (!manuallyEditableProspectStatuses.has(targetStatus)) throw new Error('This status is controlled by the governed acquisition workflow.');

    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('id,status,converted_lead_id,company_name,next_action')
      .eq('organisation_id', organisationId)
      .eq('id', prospectId)
      .single();
    if (prospectError || !prospect) throw new Error('Prospect not found.');
    if (prospect.converted_lead_id || prospect.status === 'converted') throw new Error('Converted opportunities are controlled by Case 360.');
    if (prospect.status === 'qualified') throw new Error('Qualified opportunities are controlled by the approved Go / No-Go decision.');
    if (prospect.status === targetStatus) throw new Error('Select a different status.');
    if ((targetStatus === 'not_a_fit' || prospect.status === 'not_a_fit') && reason.length < 5) throw new Error('Record a brief reason when closing or reopening an opportunity.');

    const nextActionByStatus: Record<string,string> = {
      identified: 'Establish contact and confirm initial interest',
      contacted: 'Follow up initial contact',
      conversation: 'Confirm requirement and prepare requirements request',
      not_a_fit: 'Closed as not a fit',
    };
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from('prospects').update({
      status: targetStatus,
      next_action: nextActionByStatus[targetStatus],
      updated_at: now,
    }).eq('organisation_id', organisationId).eq('id', prospectId);
    if (updateError) throw new Error(updateError.message);

    await recordActivity(supabase, {
      organisationId,
      entityType: 'prospect',
      entityId: prospectId,
      userId: user.id,
      eventType: 'prospect.status_changed',
      eventData: { reason: reason || null, source: 'manual_early_stage_control' },
      oldValue: { status: prospect.status, nextAction: prospect.next_action },
      newValue: { status: targetStatus, nextAction: nextActionByStatus[targetStatus] },
    });

    if (targetStatus === 'not_a_fit') await cancelEntityReminders(supabase,{organisationId,entityType:'prospect',entityId:prospectId}).catch(()=>0);
    revalidatePath(`/workspace/acquisition/${prospectId}`);
    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace/acquisition/prospects');
    revalidatePath('/workspace');
    destination = acquisitionUrl(prospectId,{updated:'Opportunity status updated',focus:'record-next-action'});
  } catch (error) {
    destination = prospectId
      ? acquisitionUrl(prospectId,{error:error instanceof Error?error.message:'Status could not be updated.',focus:'record-next-action'})
      : '/workspace/acquisition';
  }

  redirect(destination);
}

const outreachStatuses = new Set(['not_contacted','message_sent','follow_up_due','replied','no_response','paused']);
const responseOutcomes = new Set(['interested','later','referred','not_interested','no_response']);

export async function updateProspectOutreachAction(formData: FormData) {
  const prospectId=String(formData.get('prospect_id')||'').trim();
  let destination=prospectId?acquisitionUrl(prospectId):'/workspace/acquisition';
  try{
    const {supabase,user,profile,organisationId}=await requireUserContext();
    assertRole(profile.role,['owner','admin','business_development','operator']);
    const outreachStatus=String(formData.get('outreach_status')||'').trim();
    const responseOutcome=String(formData.get('response_outcome')||'').trim();
    const followUp=String(formData.get('next_follow_up_at')||'').trim();
    const note=String(formData.get('outreach_note')||'').trim();
    if(!prospectId||!outreachStatuses.has(outreachStatus))throw new Error('Select a valid outreach action.');
    if(responseOutcome&&!responseOutcomes.has(responseOutcome))throw new Error('Select a valid reply outcome.');
    if(outreachStatus==='replied'&&!responseOutcome)throw new Error('Record the reply outcome.');
    if(outreachStatus==='follow_up_due'&&!followUp)throw new Error('Set the next follow-up date and time.');
    const {data:prospect,error:readError}=await supabase.from('prospects').select('id,status,converted_lead_id,outreach_status,response_outcome,next_follow_up_at').eq('organisation_id',organisationId).eq('id',prospectId).single();
    if(readError||!prospect)throw new Error('Prospect not found.');
    if(prospect.converted_lead_id||prospect.status==='converted')throw new Error('Converted opportunities are managed through the client account.');
    const now=new Date().toISOString();
    const updates={outreach_status:outreachStatus,response_outcome:responseOutcome||null,next_follow_up_at:followUp?new Date(followUp).toISOString():null,last_contacted_at:outreachStatus==='message_sent'?now:undefined,last_reply_at:outreachStatus==='replied'?now:undefined,updated_at:now};
    const {error:updateError}=await supabase.from('prospects').update(updates).eq('organisation_id',organisationId).eq('id',prospectId);if(updateError)throw new Error(updateError.message);
    await recordActivity(supabase,{organisationId,entityType:'prospect',entityId:prospectId,userId:user.id,eventType:'prospect.outreach_updated',eventData:{note:note||null,channel:'linkedin'},oldValue:{outreachStatus:prospect.outreach_status,responseOutcome:prospect.response_outcome,nextFollowUpAt:prospect.next_follow_up_at},newValue:{outreachStatus,responseOutcome:responseOutcome||null,nextFollowUpAt:updates.next_follow_up_at}});
    revalidatePath(`/workspace/acquisition/${prospectId}`);revalidatePath('/workspace/acquisition');revalidatePath('/workspace/acquisition/prospects');revalidatePath('/workspace');
    destination=acquisitionUrl(prospectId,{updated:'Outreach activity recorded',focus:'record-communications'});
  }catch(error){destination=acquisitionUrl(prospectId,{error:error instanceof Error?error.message:'Outreach could not be recorded.',focus:'record-communications'});}
  redirect(destination);
}

export async function convertProspectAction(formData: FormData): Promise<ActionResult<Lead>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const prospectId = String(formData.get('prospect_id') || '');
    if (!prospectId) return { ok: false, error: 'Prospect ID is required.' };
    const { data: lead, error } = await supabase.rpc('op_convert_prospect', { p_organisation_id:organisationId, p_user_id:user.id, p_prospect_id:prospectId });
    if (error) throw new Error(error.message);
    if (!lead?.id) throw new Error('Case 360 was not returned after conversion.');
    await cancelEntityReminders(supabase,{organisationId,entityType:'prospect',entityId:prospectId}).catch(()=>0);
    revalidatePath(`/workspace/acquisition/${prospectId}`); revalidatePath('/workspace/acquisition'); revalidatePath('/workspace/leads'); revalidatePath('/workspace/orchestration'); revalidatePath('/workspace');
    return { ok: true, data: lead as Lead };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to convert prospect.' }; }
}

export async function convertProspectFormAction(formData: FormData) {
  const prospectId=String(formData.get('prospect_id')||'');
  const result = await convertProspectAction(formData);
  redirect(result.ok
    ? `/workspace/leads/${result.data.id}?success=${encodeURIComponent('Prospect converted. Case 360 now owns the controlled technical and commercial conversion workflow.')}&focus=record-next-action`
    : prospectId
      ? acquisitionUrl(prospectId,{error:result.error,focus:'record-next-action'})
      : `/workspace/acquisition?error=${encodeURIComponent(result.error)}`);
}
