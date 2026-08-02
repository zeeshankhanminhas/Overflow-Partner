'use server';

import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { prospectInputSchema } from '@/lib/validation/prospects';
import { createProspect } from '@/lib/repositories/prospects';
import { recordActivity } from '@/lib/repositories/activity';
import type { ActionResult, Prospect } from '@/types/domain';

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
