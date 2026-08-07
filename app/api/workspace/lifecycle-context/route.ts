import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import { normaliseProjectStage } from '@/lib/projects/stages';

export const dynamic = 'force-dynamic';

type LifecycleStage = 'acquire' | 'assess' | 'commercial' | 'deliver' | 'close';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    const id = request.nextUrl.searchParams.get('id');
    if (!id || !['case', 'project'].includes(String(type))) {
      return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
    }

    const { supabase, organisationId } = await requireUserContext();
    let stage: LifecycleStage;

    if (type === 'case') {
      const workflow = (await listWorkflowCases(supabase, organisationId)).find((item) => item.lead.id === id);
      if (!workflow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      if (workflow.project) stage = 'deliver';
      else if (['partner_pricing', 'commercial_review', 'client_quote'].includes(workflow.stage)) stage = 'commercial';
      else stage = 'assess';
    } else {
      const { data: project, error } = await supabase
        .from('projects')
        .select('id,status,project_stage')
        .eq('organisation_id', organisationId)
        .eq('id', id)
        .single();
      if (error || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const projectStage = normaliseProjectStage(project.project_stage);
      stage = projectStage === 'completion' || projectStage === 'closed' || ['completed', 'closed'].includes(project.status)
        ? 'close'
        : 'deliver';
    }

    return NextResponse.json({ stage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to resolve lifecycle state.' }, { status: 500 });
  }
}
