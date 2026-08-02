'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { leadInputSchema } from '@/lib/validation/leads';
import { createLead } from '@/lib/repositories/leads';
import { getCompanyById } from '@/lib/repositories/companies';
import { getContactById } from '@/lib/repositories/contacts';
import { recordActivity } from '@/lib/repositories/activity';
import type { ActionResult, Lead } from '@/types/domain';

export async function createLeadAction(formData: FormData): Promise<ActionResult<Lead>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const raw = Object.fromEntries(formData.entries());
    const companyId = String(raw.company_id || '');
    if (!companyId) return { ok: false, error: 'Select a company.' };
    const company = await getCompanyById(supabase, organisationId, companyId);
    const contactId = String(raw.contact_id || '');
    const contact = contactId ? await getContactById(supabase, organisationId, contactId) : null;
    if (contact && contact.company_id && contact.company_id !== company.id) return { ok: false, error: 'The selected contact does not belong to the selected company.' };
    const parsed = leadInputSchema.safeParse({ ...raw, company_id: company.id, company_name: company.name, contact_id: contact?.id || '', contact_name: contact?.full_name || '', contact_email: contact?.email || '' });
    if (!parsed.success) return { ok: false, error: 'Please correct the highlighted lead details.', fieldErrors: parsed.error.flatten().fieldErrors };
    const lead = await createLead(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, { organisationId, entityType: 'lead', entityId: lead.id, userId: user.id, eventType: 'lead.created', newValue: lead });
    revalidatePath('/workspace/leads'); revalidatePath(`/workspace/companies/${company.id}`); revalidatePath('/workspace');
    return { ok: true, data: lead };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Unable to create lead.' }; }
}

export async function createLeadFormAction(formData: FormData) {
  const result = await createLeadAction(formData);
  redirect(result.ok ? '/workspace/leads?created=1' : `/workspace/leads?error=${encodeURIComponent(result.error)}`);
}
