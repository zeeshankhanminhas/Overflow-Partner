'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { technicalIntakeInputSchema } from '@/lib/validation/technical-intakes';
import { createTechnicalIntake } from '@/lib/repositories/technical-intakes';
import { getLeadById, updateLeadStatus } from '@/lib/repositories/leads';
import { recordActivity } from '@/lib/repositories/activity';
import type { ActionResult, TechnicalIntake } from '@/types/domain';

export async function createTechnicalIntakeAction(formData: FormData): Promise<ActionResult<TechnicalIntake>> {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'operator', 'engineering', 'business_development']);

    const parsed = technicalIntakeInputSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Please correct the technical intake details.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const lead = await getLeadById(supabase, organisationId, parsed.data.lead_id);
    if (['won', 'lost'].includes(lead.status)) {
      return { ok: false, error: 'A technical intake cannot be added to a closed lead.' };
    }

    const intake = await createTechnicalIntake(supabase, organisationId, user.id, parsed.data);
    if (parsed.data.status === 'submitted' && lead.status !== 'technical_intake') {
      await updateLeadStatus(supabase, organisationId, lead.id, 'technical_intake');
    }

    await recordActivity(supabase, {
      organisationId,
      entityType: 'technical_intake',
      entityId: intake.id,
      userId: user.id,
      eventType: parsed.data.status === 'submitted' ? 'technical_intake.submitted' : 'technical_intake.created',
      eventData: { leadId: lead.id },
      newValue: intake,
    });

    revalidatePath(`/workspace/leads/${lead.id}`);
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace');
    return { ok: true, data: intake };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to create technical intake.' };
  }
}

export async function createTechnicalIntakeFormAction(formData: FormData) {
  const leadId = String(formData.get('lead_id') ?? '');
  const result = await createTechnicalIntakeAction(formData);
  if (!result.ok) throw new Error(result.error);
  redirect(`/workspace/leads/${leadId}`);
}
