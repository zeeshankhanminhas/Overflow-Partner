import type { SupabaseClient } from '@supabase/supabase-js';

type ActivityInput = {
  organisationId: string;
  entityType: string;
  entityId: string;
  userId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function recordActivity(supabase: SupabaseClient, input: ActivityInput) {
  const { error } = await supabase.from('activity_events').insert({
    organisation_id: input.organisationId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    user_id: input.userId,
    event_type: input.eventType,
    event_data: input.eventData ?? {},
    old_value: input.oldValue ?? null,
    new_value: input.newValue ?? null,
  });

  if (error) throw new Error(`Activity logging failed: ${error.message}`);
}
