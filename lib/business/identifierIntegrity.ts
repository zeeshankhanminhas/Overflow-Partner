import type { SupabaseClient } from '@supabase/supabase-js';

export function normaliseControlledReference(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

async function assertUnique(
  supabase: SupabaseClient,
  organisationId: string,
  table: 'projects' | 'documents',
  column: 'project_number' | 'reference',
  value: string,
  label: string,
) {
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('organisation_id', organisationId)
    .ilike(column, value)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not validate ${label}: ${error.message}`);
  if (data) throw new Error(`${label} “${value}” already exists in this organisation.`);
}

export async function assertUniqueProjectNumber(
  supabase: SupabaseClient,
  organisationId: string,
  projectNumber: string,
) {
  const value = normaliseControlledReference(projectNumber);
  await assertUnique(supabase, organisationId, 'projects', 'project_number', value, 'Project number');
  return value;
}

export async function assertUniqueDocumentReference(
  supabase: SupabaseClient,
  organisationId: string,
  reference: string,
) {
  const value = normaliseControlledReference(reference);
  await assertUnique(supabase, organisationId, 'documents', 'reference', value, 'Document reference');
  return value;
}
