import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentRecord } from '@/types/domain';
import type { DocumentInput } from '@/lib/validation/documents';

export async function listDocuments(supabase: SupabaseClient, organisationId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DocumentRecord[];
}

export async function createDocument(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  input: DocumentInput,
) {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      organisation_id: organisationId,
      created_by: userId,
      document_type: input.document_type,
      title: input.title,
      reference: input.reference,
      lead_id: input.lead_id || null,
      status: input.status,
      version: input.version,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as DocumentRecord;
}
