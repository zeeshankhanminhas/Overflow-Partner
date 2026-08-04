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
import type { ActionResult, Lead, Prospect } from '@/types/domain';

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
    revalidatePath('/workspace/acquisition'); revalidatePath(`/workspace/companies/${company.id}`); revalidatePath('/workspace');
    return { ok: true, data: prospect };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to create prospect.' }; }
}

export async function createProspectFormAction(formData: FormData) {
  const result = await createProspectAction(formData);
  redirect(result.ok ? '/workspace/acquisition?created=1' : `/workspace/acquisition?error=${encodeURIComponent(result.error)}`);
}

export async function createStep2InvitationFormAction(formData: FormData) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const prospectId = String(formData.get('prospect_id') || '');
    if (!prospectId) throw new Error('Prospect ID is required.');
    const { data: prospect, error: prospectError } = await supabase.from('prospects').select('id,status,email').eq('organisation_id', organisationId).eq('id', prospectId).single();
    if (prospectError || !prospect) throw new Error('Prospect not found.');
    if (prospect.status === 'converted') throw new Error('This prospect has already been converted.');

    const { data: existing } = await supabase.from('intake_sessions').select('id,status,expires_at').eq('organisation_id', organisationId).eq('prospect_id', prospectId).not('status', 'in', '(converted,expired,cancelled)').maybeSingle();
    if (existing) throw new Error('An active Step 2 invitation already exists. Cancel or complete it before creating another.');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const { data: session, error } = await supabase.from('intake_sessions').insert({ organisation_id: organisationId, prospect_id: prospectId, token_hash: tokenHash, status: 'invited', expires_at: expiresAt, sent_at: now, created_by: user.id }).select('id').single();
    if (error) throw error;
    await supabase.from('prospects').update({ next_action: 'Await customer technical intake' }).eq('id', prospectId);
    await supabase.from('activity_events').insert({ organisation_id: organisationId, user_id: user.id, entity_type: 'prospect', entity_id: prospectId, event_type: 'technical_intake_invited', event_data: { intakeSessionId: session.id, expiresAt, delivery: prospect.email ? 'link_ready_for_email' : 'link_ready' } });
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://overflow-partner.vercel.app';
    const url = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/intake/${token}`;
    revalidatePath('/workspace/acquisition'); revalidatePath('/workspace');
    redirect(`/workspace/acquisition?invitation=${encodeURIComponent(url)}`);
  } catch (error) {
    redirect(`/workspace/acquisition?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to create Step 2 invitation.')}`);
  }
}

export async function qualifyProspectFormAction(formData: FormData) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const prospectId = String(formData.get('prospect_id') || '');
    if (!prospectId) throw new Error('Prospect ID is required.');

    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('id,status,company_name,project_type,requirement_summary')
      .eq('organisation_id', organisationId)
      .eq('id', prospectId)
      .single();
    if (prospectError || !prospect) throw new Error('Prospect not found.');
    if (prospect.status === 'converted') throw new Error('This prospect has already been converted.');
    if (prospect.status === 'qualified') {
      redirect('/workspace/acquisition?qualified=1');
    }
    if (!prospect.company_name?.trim() || !prospect.project_type?.trim() || !prospect.requirement_summary?.trim()) {
      throw new Error('Company, project type and requirement summary are required before qualification.');
    }

    const { data: session, error: sessionError } = await supabase
      .from('intake_sessions')
      .select('id,status,submitted_at')
      .eq('organisation_id', organisationId)
      .eq('prospect_id', prospectId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new Error('A submitted Step 2 technical intake is required before qualification.');

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('prospects')
      .update({ status: 'qualified', next_action: 'Convert qualified prospect to governed lead', assigned_to: user.id, updated_at: now })
      .eq('organisation_id', organisationId)
      .eq('id', prospectId);
    if (updateError) throw updateError;

    const { error: activityError } = await supabase.from('activity_events').insert({
      organisation_id: organisationId,
      user_id: user.id,
      entity_type: 'prospect',
      entity_id: prospectId,
      event_type: 'prospect_qualified',
      event_data: { intakeSessionId: session.id, qualifiedAt: now, previousStatus: prospect.status },
    });
    if (activityError) throw activityError;

    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace');
    redirect('/workspace/acquisition?qualified=1');
  } catch (error) {
    redirect(`/workspace/acquisition?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to qualify prospect.')}`);
  }
}

export async function convertProspectAction(formData: FormData): Promise<ActionResult<Lead>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const prospectId = String(formData.get('prospect_id') || '');
    if (!prospectId) return { ok: false, error: 'Prospect ID is required.' };
    const lead = await convertProspectToLead(supabase, organisationId, user.id, prospectId);
    revalidatePath('/workspace/acquisition'); revalidatePath('/workspace/leads'); revalidatePath('/workspace/orchestration'); revalidatePath('/workspace');
    return { ok: true, data: lead };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to convert prospect.' }; }
}

export async function convertProspectFormAction(formData: FormData) {
  const result = await convertProspectAction(formData);
  redirect(result.ok ? '/workspace/leads?converted=1' : `/workspace/acquisition?error=${encodeURIComponent(result.error)}`);
}
