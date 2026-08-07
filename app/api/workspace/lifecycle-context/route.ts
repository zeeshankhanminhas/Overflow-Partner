import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/lib/auth/context';
import { getWorkflowCase } from '@/lib/orchestration/service';
import { lifecycleFromProject, lifecycleFromWorkflowStage } from '@/lib/lifecycle/resolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    const id = request.nextUrl.searchParams.get('id');
    if (!id || !['case', 'project'].includes(String(type))) {
      return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
    }

    const { supabase, organisationId } = await requireUserContext();

    if (type === 'case') {
      const workflow = await getWorkflowCase(supabase, organisationId, id);
      if (!workflow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      return NextResponse.json({ stage: lifecycleFromWorkflowStage(workflow.stage, workflow.project) });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .select('id,status,project_stage')
      .eq('organisation_id', organisationId)
      .eq('id', id)
      .single();
    if (error || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ stage: lifecycleFromProject(project) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to resolve lifecycle state.' }, { status: 500 });
  }
}
