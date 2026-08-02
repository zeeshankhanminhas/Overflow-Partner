'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { documentInputSchema } from '@/lib/validation/documents';
import { createDocument } from '@/lib/repositories/documents';
import { recordActivity } from '@/lib/repositories/activity';

export async function createDocumentAction(formData: FormData) {
  const { supabase, user, profile, organisationId } = await requireUserContext();
  assertRole(profile.role, ['owner', 'admin', 'operator', 'engineering', 'commercial']);

  const parsed = documentInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    redirect(`/workspace/documents?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Invalid document details')}`);
  }

  try {
    const document = await createDocument(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, {
      organisationId,
      entityType: 'document',
      entityId: document.id,
      userId: user.id,
      eventType: 'document.created',
      newValue: document,
    });
    revalidatePath('/workspace/documents');
    revalidatePath('/workspace');
    redirect('/workspace/documents?created=1');
  } catch (error) {
    redirect(`/workspace/documents?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to create document')}`);
  }
}
