'use server';

import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { leadInputSchema } from '@/lib/validation/leads';
import { createLead } from '@/lib/repositories/leads';
import { recordActivity } from '@/lib/repositories/activity';
import type { ActionResult, Lead } from '@/types/domain';

export async function createLeadAction(formData: FormData): Promise<ActionResult<Lead>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);

    const parsed = leadInputSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Please correct the highlighted lead details.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const lead = await createLead(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, {
      organisationId,
      entityType: 'lead',
      entityId: lead.id,
      userId: user.id,
      eventType: 'lead.created',
      newValue: lead,
    });

    revalidatePath('/workspace/leads');
    revalidatePath('/workspace');
    return { ok: true, data: lead };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create lead.' };
  }
}
