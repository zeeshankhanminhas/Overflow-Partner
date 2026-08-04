'use server';

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
    const parsed = prospectInputSchema.safeParse({
      ...raw, company_id: company.id, company_name: company.name, contact_id: contact?.id || '',
      contact_name: contact?.full_name || '', job_title: contact?.job_title || '',
      linkedin_url: contact?.linkedin_url || '', email: contact?.email || '', phone: contact?.phone || '',
      industry: company.industry || '',
    });
    if (!parsed.success) return { ok: false, error: 'Please correct the highlighted prospect details.', fieldErrors: parsed.error.flatten().fieldErrors };
    const prospect = await createProspect(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, { organisationId, entityType: 'prospect', entityId: prospect.id,
      userId: user.id, eventType: 'prospect.created', newValue: prospect });
    revalidatePath('/workspace/acquisition'); revalidatePath(`/workspace/companies/${company.id}`); revalidatePath('/workspace');
    return { ok: true, data: prospect };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to create prospect.' }; }
}

export async function createProspectFormAction(formData: FormData) {
  const result = await createProspectAction(formData);
  redirect(result.ok ? '/workspace/acquisition?created=1' : `/workspace/acquisition?error=${encodeURIComponent(result.error)}`);
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
