'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { prospectInputSchema } from '@/lib/validation/prospects';
import { leadInputSchema } from '@/lib/validation/leads';
import { createProspect, getProspectById, markProspectConverted } from '@/lib/repositories/prospects';
import { createLead } from '@/lib/repositories/leads';
import { recordActivity } from '@/lib/repositories/activity';
import type { ActionResult, Lead, Prospect } from '@/types/domain';

export async function createProspectAction(formData: FormData): Promise<ActionResult<Prospect>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);

    const parsed = prospectInputSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Please correct the highlighted prospect details.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const prospect = await createProspect(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, {
      organisationId,
      entityType: 'prospect',
      entityId: prospect.id,
      userId: user.id,
      eventType: 'prospect.created',
      newValue: prospect,
    });

    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace');
    return { ok: true, data: prospect };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create prospect.' };
  }
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

    const prospect = await getProspectById(supabase, organisationId, prospectId);
    if (prospect.status !== 'qualified') {
      return { ok: false, error: 'Only qualified prospects can be converted into leads.' };
    }
    if (prospect.converted_lead_id) {
      return { ok: false, error: 'This prospect has already been converted.' };
    }

    const parsed = leadInputSchema.safeParse({
      company_name: prospect.company_name,
      contact_name: prospect.contact_name || '',
      contact_email: prospect.email || '',
      project_type: String(formData.get('project_type') || ''),
      title: String(formData.get('title') || `${prospect.company_name} engineering requirement`),
      service: String(formData.get('service') || 'Engineering overflow support'),
      priority: String(formData.get('priority') || 'normal'),
      status: 'new',
      source: prospect.source,
      prospect_id: prospect.id,
      notes: prospect.notes || '',
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: 'The prospect could not be converted because required lead information is missing.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const lead = await createLead(supabase, organisationId, user.id, parsed.data);
    const convertedProspect = await markProspectConverted(supabase, prospect.id, lead.id);

    await recordActivity(supabase, {
      organisationId,
      entityType: 'prospect',
      entityId: prospect.id,
      userId: user.id,
      eventType: 'prospect.converted',
      oldValue: prospect,
      newValue: convertedProspect,
      eventData: { lead_id: lead.id },
    });
    await recordActivity(supabase, {
      organisationId,
      entityType: 'lead',
      entityId: lead.id,
      userId: user.id,
      eventType: 'lead.created_from_prospect',
      newValue: lead,
      eventData: { prospect_id: prospect.id },
    });

    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace');
    return { ok: true, data: lead };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to convert prospect.' };
  }
}

export async function convertProspectFormAction(formData: FormData) {
  const result = await convertProspectAction(formData);
  redirect(result.ok ? '/workspace/leads?converted=1' : `/workspace/acquisition?error=${encodeURIComponent(result.error)}`);
}
