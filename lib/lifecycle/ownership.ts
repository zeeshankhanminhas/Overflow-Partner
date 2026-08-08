import type { SupabaseClient } from '@supabase/supabase-js';
import { normaliseProjectStage } from '@/lib/projects/stages';

export type LifecycleOwner = 'prospect' | 'case' | 'project' | 'closed';
export type ActiveWorkspace = 'acquisition' | 'case_360' | 'project_360' | 'archive';
export type LifecycleIdentity = { type: 'prospect' | 'case' | 'project'; id: string };

export type LifecycleOwnershipInput = {
  prospectId?: string | null;
  prospectStatus?: string | null;
  convertedCaseId?: string | null;
  caseId?: string | null;
  caseStatus?: string | null;
  projectId?: string | null;
  projectStatus?: string | null;
  projectStage?: string | null;
};

export type LifecycleOwnership = {
  owner: LifecycleOwner;
  activeWorkspace: ActiveWorkspace;
  currentId: string | null;
  active: boolean;
  previousIdentities: LifecycleIdentity[];
};

const closedProjectStatuses = new Set(['completed', 'closed', 'cancelled']);

export function resolveLifecycleOwnership(input: LifecycleOwnershipInput): LifecycleOwnership {
  const previousIdentities: LifecycleIdentity[] = [];
  if (input.prospectId) previousIdentities.push({ type: 'prospect', id: input.prospectId });
  if (input.caseId) previousIdentities.push({ type: 'case', id: input.caseId });

  if (input.projectId) {
    const stage = normaliseProjectStage(input.projectStage);
    const closed = stage === 'closed' || closedProjectStatuses.has(String(input.projectStatus || ''));
    return {
      owner: closed ? 'closed' : 'project',
      activeWorkspace: closed ? 'archive' : 'project_360',
      currentId: input.projectId,
      active: !closed,
      previousIdentities,
    };
  }

  if (input.caseId || input.convertedCaseId || input.prospectStatus === 'converted') {
    const caseId = input.caseId || input.convertedCaseId || null;
    return {
      owner: 'case',
      activeWorkspace: 'case_360',
      currentId: caseId,
      active: true,
      previousIdentities: input.prospectId ? [{ type: 'prospect', id: input.prospectId }] : [],
    };
  }

  return {
    owner: 'prospect',
    activeWorkspace: 'acquisition',
    currentId: input.prospectId || null,
    active: true,
    previousIdentities: [],
  };
}

export async function resolveCaseOwnership(
  supabase: SupabaseClient,
  organisationId: string,
  caseId: string,
): Promise<LifecycleOwnership> {
  const [{ data: lead, error: leadError }, { data: project, error: projectError }] = await Promise.all([
    supabase.from('leads').select('id,status').eq('organisation_id', organisationId).eq('id', caseId).maybeSingle(),
    supabase.from('projects').select('id,status,project_stage').eq('organisation_id', organisationId).eq('lead_id', caseId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (leadError) throw new Error(leadError.message);
  if (projectError) throw new Error(projectError.message);
  if (!lead) throw new Error('Case not found.');
  return resolveLifecycleOwnership({
    caseId: lead.id,
    caseStatus: lead.status,
    projectId: project?.id,
    projectStatus: project?.status,
    projectStage: project?.project_stage,
  });
}

export async function resolveProspectOwnership(
  supabase: SupabaseClient,
  organisationId: string,
  prospectId: string,
): Promise<LifecycleOwnership> {
  const { data: prospect, error } = await supabase.from('prospects').select('id,status,converted_lead_id').eq('organisation_id', organisationId).eq('id', prospectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!prospect) throw new Error('Prospect not found.');
  if (!prospect.converted_lead_id) return resolveLifecycleOwnership({ prospectId: prospect.id, prospectStatus: prospect.status });
  const caseOwnership = await resolveCaseOwnership(supabase, organisationId, prospect.converted_lead_id);
  return {
    ...caseOwnership,
    previousIdentities: [{ type: 'prospect', id: prospect.id }, ...caseOwnership.previousIdentities.filter(item => item.type !== 'prospect')],
  };
}
