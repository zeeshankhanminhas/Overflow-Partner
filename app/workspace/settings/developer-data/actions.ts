'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext } from '@/lib/auth/context';

const allowedTypes = ['prospect','case','project','document','company','invoice','partner_payable'] as const;
type DeleteType = (typeof allowedTypes)[number];

function developerDataUrl(params: Record<string,string>) {
  return `/workspace/settings/developer-data?${new URLSearchParams(params).toString()}`;
}

export async function deleteDeveloperTestRecordAction(formData: FormData) {
  const entityType = String(formData.get('entity_type') || '').trim() as DeleteType;
  const entityId = String(formData.get('entity_id') || '').trim();
  const confirmation = String(formData.get('confirmation') || '').trim();
  let destination = '/workspace/settings/developer-data';

  try {
    if (!allowedTypes.includes(entityType)) throw new Error('Unsupported record type.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)) {
      throw new Error('Enter a valid record UUID.');
    }

    const expected = `DELETE ${entityType.toUpperCase()} ${entityId}`;
    if (confirmation !== expected) {
      throw new Error(`Confirmation must exactly match: ${expected}`);
    }

    const { supabase } = await requireUserContext();
    const { data: permitted, error: permissionError } = await supabase.rpc('op_can_delete_test_data');
    if (permissionError || permitted !== true) {
      throw new Error('Developer delete capability is not enabled for this account.');
    }

    const { error } = await supabase.rpc('op_delete_test_record', {
      p_entity_type: entityType,
      p_entity_id: entityId,
    });
    if (error) throw new Error(error.message);

    revalidatePath('/workspace');
    revalidatePath('/workspace/acquisition');
    revalidatePath('/workspace/acquisition/prospects');
    revalidatePath('/workspace/leads');
    revalidatePath('/workspace/projects');
    revalidatePath('/workspace/documents');
    revalidatePath('/workspace/companies');
    revalidatePath('/workspace/commercial-control');
    destination = developerDataUrl({ deleted: `${entityType} ${entityId} deleted.` });
  } catch (error) {
    destination = developerDataUrl({ error: error instanceof Error ? error.message : 'Record could not be deleted.' });
  }

  redirect(destination);
}
