'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext } from '@/lib/auth/context';

const allowedTypes = new Set(['prospect','lead','project','document','company']);

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) || '').trim();
  if (!value) throw new Error(`${key.replaceAll('_',' ')} is required.`);
  return value;
}

export async function developerDeleteRecordAction(formData: FormData) {
  const entityType = required(formData,'entity_type').toLowerCase();
  const entityId = required(formData,'entity_id');
  const returnToRaw = String(formData.get('return_to') || '/workspace').trim();
  const returnTo = returnToRaw.startsWith('/workspace') ? returnToRaw : '/workspace';

  let destination = returnTo;
  try {
    if (!allowedTypes.has(entityType)) throw new Error('This record type cannot be developer-deleted.');
    const { supabase, profile } = await requireUserContext();
    if (!profile.developer_delete_enabled) throw new Error('Developer test deletion is not enabled for this account.');

    const { error } = await supabase.rpc('op_developer_delete_test_record', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace/acquisition/prospects');
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace/projects');
    revalidatePath('/workspace/documents');
    revalidatePath('/workspace/companies');
    revalidatePath('/workspace/management');
    destination = `${returnTo}${returnTo.includes('?') ? '&' : '?'}deleted=1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The test record could not be deleted.';
    destination = `${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
