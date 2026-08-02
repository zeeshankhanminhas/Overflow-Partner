import type { SupabaseClient } from '@supabase/supabase-js';
import type { TechnicalIntake } from '@/types/domain';
import type { TechnicalIntakeInput } from '@/lib/validation/technical-intakes';

export async function listTechnicalIntakesForLead(
  supabase: SupabaseClient,
  organisationId: string,
  leadId: string,
) {
  const { data, error } = await supabase
    .from('technical_intakes')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TechnicalIntake[];
}

export async function createTechnicalIntake(
  supabase: SupabaseClient,
  organisationId: string,
  userId: string,
  input: TechnicalIntakeInput,
) {
  const submittedAt = input.status === 'submitted' ? new Date().toISOString() : null;
  const { data, error } = await supabase
    .from('technical_intakes')
    .insert({
      organisation_id: organisationId,
      lead_id: input.lead_id,
      project_type: input.project_type || null,
      discipline: input.discipline || null,
      description: input.description,
      deliverables: input.deliverables || null,
      deadline: input.deadline || null,
      special_requirements: input.special_requirements || null,
      status: input.status,
      submitted_at: submittedAt,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as TechnicalIntake;
}
