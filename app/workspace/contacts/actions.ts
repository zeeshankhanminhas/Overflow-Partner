'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';
import { contactInputSchema } from '@/lib/validation/contacts';
import { createContact, getContactById, updateContact } from '@/lib/repositories/contacts';
import { recordActivity } from '@/lib/repositories/activity';
import { getCompanyById } from '@/lib/repositories/companies';

export async function createContactFormAction(formData: FormData) {
  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
    const parsed = contactInputSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) redirect(`/workspace/contacts?error=${encodeURIComponent('Please correct the contact details.')}`);
    await getCompanyById(supabase,organisationId,parsed.data.company_id);
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

export async function updateContactFormAction(formData: FormData) {
  const { supabase, user, profile, organisationId } = await requireUserContext();
  assertRole(profile.role, ['owner', 'admin', 'business_development', 'operator']);
  const contactId=String(formData.get('contact_id')||'').trim();
  if(!contactId) redirect('/workspace/contacts?error=Missing%20contact%20record.');
  const parsed=contactInputSchema.safeParse(Object.fromEntries(formData.entries()));
  if(!parsed.success) redirect(`/workspace/contacts/${contactId}?error=${encodeURIComponent('Please correct the contact details.')}`);

  try {
    await getCompanyById(supabase,organisationId,parsed.data.company_id);
    const previous=await getContactById(supabase,organisationId,contactId);
    const contact=await updateContact(supabase,organisationId,contactId,parsed.data);
    await recordActivity(supabase,{organisationId,entityType:'contact',entityId:contact.id,userId:user.id,eventType:'contact.updated',oldValue:previous,newValue:contact});
    revalidatePath('/workspace/contacts');
    revalidatePath(`/workspace/contacts/${contact.id}`);
    revalidatePath('/workspace/companies');
    if(previous.company_id)revalidatePath(`/workspace/companies/${previous.company_id}`);
    if(contact.company_id)revalidatePath(`/workspace/companies/${contact.company_id}`);
  } catch(error) {
    redirect(`/workspace/contacts/${contactId}?error=${encodeURIComponent(error instanceof Error?error.message:'Unable to update contact.')}`);
  }
  redirect(`/workspace/contacts/${contactId}?updated=1`);
}
