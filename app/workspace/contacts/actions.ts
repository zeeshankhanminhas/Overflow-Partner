'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { contactInputSchema } from '@/lib/validation/contacts';
import { createContact } from '@/lib/repositories/contacts';
import { recordActivity } from '@/lib/repositories/activity';

export async function createContactFormAction(formData: FormData) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const parsed = contactInputSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(`/workspace/contacts?error=${encodeURIComponent('Please correct the contact details.')}`);
    const contact = await createContact(supabase, organisationId, user.id, parsed.data);
    await recordActivity(supabase, { organisationId, entityType: 'contact', entityId: contact.id, userId: user.id, eventType: 'contact.created', newValue: contact });
    revalidatePath('/workspace/contacts');
    revalidatePath('/workspace/companies');
    if (contact.company_id) revalidatePath(`/workspace/companies/${contact.company_id}`);
    redirect('/workspace/contacts?created=1');
  } catch (error) {
    redirect(`/workspace/contacts?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unable to create contact.')}`);
  }
}
