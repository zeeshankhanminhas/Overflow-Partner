'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { documentInputSchema } from '@/lib/validation/documents';
import { createDocument } from '@/lib/repositories/documents';
import { recordActivity } from '@/lib/repositories/activity';
import { assertCaseIsActive } from '@/lib/business/invariants';

export async function createDocumentAction(formData: FormData) {
  const { supabase, user, profile, organisationId } = await requireUserContext();
  assertRole(profile.role, ['owner', 'admin', 'operator', 'engineering', 'commercial']);

  const parsed = documentInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    redirect(`/workspace/documents?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid document details')}`);
  }

  try {
    const leadId = String(parsed.data.lead_id || '');
    if (!leadId) throw new Error('A governed active Case is required for manual document creation. Project evidence must be created from Project 360.');
    await assertCaseIsActive(supabase, organisationId, leadId);
    const safeInput = { ...parsed.data, status: 'draft' as const };
    const document = await createDocument(supabase, organisationId, user.id, safeInput);
    await recordActivity(supabase, {
      organisationId,
      entityType: 'document',
      entityId: document.id,
      userId: user.id,
      eventType: 'document.created',
      newValue: { ...document, invariant: 'ACTIVE_CASE_SINGLE_OWNER_DRAFT_ONLY' },
    });
    revalidatePath('/workspace/documents');
    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath('/workspace');
    redirect('/workspace/documents?created=1');
  } catch (error) {
    redirect(`/workspace/documents?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to create document')}`);
  }
}
