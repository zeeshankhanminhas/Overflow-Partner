import type { SupabaseClient } from '@supabase/supabase-js';

type CountResult = { count: number | null; error: { message: string } | null };

export type DashboardActivity = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
};

export type DashboardSnapshot = {
  prospects: number;
  qualifiedProspects: number;
  openLeads: number;
  technicalIntakesAwaitingReview: number;
  partnerRfqsOutstanding: number;
  quotesAwaitingApproval: number;
  activeProjects: number;
  documents: number;
  todaysActivity: number;
  recentActivity: DashboardActivity[];
  warnings: string[];
};

async function safeCount(
  promise: PromiseLike<CountResult>,
  label: string,
  warnings: string[],
): Promise<number> {
  const result = await promise;
  if (result.error) {
    warnings.push(`${label}: ${result.error.message}`);
    return 0;
  }
  return result.count ?? 0;
}

export async function getDashboardSnapshot(
  supabase: SupabaseClient,
  organisationId: string,
): Promise<DashboardSnapshot> {
  const warnings: string[] = [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    prospects,
    qualifiedProspects,
    openLeads,
    technicalIntakesAwaitingReview,
    partnerRfqsOutstanding,
    quotesAwaitingApproval,
    activeProjects,
    documents,
    todaysActivity,
  ] = await Promise.all([
    safeCount(
      supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId),
      'Prospects', warnings,
    ),
    safeCount(
      supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).eq('status', 'qualified'),
      'Qualified prospects', warnings,
    ),
    safeCount(
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).not('status', 'in', '(won,lost)'),
      'Open leads', warnings,
    ),
    safeCount(
      supabase.from('technical_intakes').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).in('status', ['submitted', 'under_review', 'clarification_required']),
      'Technical intakes', warnings,
    ),
    safeCount(
      supabase.from('partner_quotes').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).eq('status', 'requested'),
      'Partner RFQs', warnings,
    ),
    safeCount(
      supabase.from('commercial_reviews').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).eq('status', 'pending_approval'),
      'Commercial reviews', warnings,
    ),
    safeCount(
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).eq('status', 'active'),
      'Active projects', warnings,
    ),
    safeCount(
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId),
      'Documents', warnings,
    ),
    safeCount(
      supabase.from('activity_events').select('id', { count: 'exact', head: true }).eq('organisation_id', organisationId).gte('created_at', startOfToday.toISOString()),
      "Today's activity", warnings,
    ),
  ]);

  const { data: activity, error: activityError } = await supabase
    .from('activity_events')
    .select('id, entity_type, entity_id, event_type, event_data, created_at')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (activityError) warnings.push(`Recent activity: ${activityError.message}`);

  return {
    prospects,
    qualifiedProspects,
    openLeads,
    technicalIntakesAwaitingReview,
    partnerRfqsOutstanding,
    quotesAwaitingApproval,
    activeProjects,
    documents,
    todaysActivity,
    recentActivity: (activity ?? []) as DashboardActivity[],
    warnings,
  };
}
