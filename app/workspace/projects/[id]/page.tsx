import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getProjectById } from '@/lib/repositories/workflow';
import { workspaceLabel } from '@/lib/presentation/vocabulary';
import { normaliseProjectStage, projectStageMeta, projectStages } from '@/lib/projects/stages';
import { advanceProjectStageAction } from './actions';

function value(record: Record<string, unknown> | null | undefined, key: string, fallback = 'Not recorded') {
  const entry = record?.[key];
  return entry === null || entry === undefined || entry === '' ? fallback : String(entry);
}

function money(amount: unknown, currency: unknown) {
  const number = Number(amount ?? 0);
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(currency || 'GBP') }).format(number); }
  catch { return `${String(currency || 'GBP')} ${number.toFixed(2)}`; }
}

export default async function ProjectWorkspacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string,string|undefined>> }) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();

  let project;
  try { project = await getProjectById(supabase, organisationId, id); }
  catch { notFound(); }

  const [{ data: tasks }, { data: documents }, { data: activity }] = await Promise.all([
    supabase.from('tasks').select('*').eq('organisation_id', organisationId).eq('entity_type', 'project').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('organisation_id', organisationId).eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_events').select('*').eq('organisation_id', organisationId).eq('entity_type', 'project').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
  ]);

  const projectRecord = project as typeof project & { project_stage?: string };
  const stage = normaliseProjectStage(projectRecord.project_stage);
  const stageMeta = projectStageMeta[stage];
  const stageIndex = projectStages.indexOf(stage);
  const lead = project.lead as Record<string, unknown> | null | undefined;
  const quote = project.quote as Record<string, unknown> | null | undefined;
  const manager = project.project_manager as Record<string, unknown> | null | undefined;
  const openTasks = (tasks ?? []).filter((task) => !['completed', 'cancelled'].includes(task.status));
  const approvedDocuments = (documents ?? []).filter((document) => ['approved','issued'].includes(document.status));
  const issuedDocuments = (documents ?? []).filter((document) => document.status === 'issued');

  const gates = [
    { label: 'Accepted quote linked', met: Boolean(project.quote_id) },
    { label: 'Delivery dates recorded', met: Boolean(project.start_date && project.due_date) },
    { label: 'Delivery activities resolved', met: (tasks ?? []).length > 0 && openTasks.length === 0 },
    { label: 'Approved release document', met: approvedDocuments.length > 0 },
    { label: 'Issued controlled document', met: issuedDocuments.length > 0 },
  ];

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">Project workspace</p><h1>{project.project_number} · {project.title}</h1><p className="vp-subtitle">Accepted work progresses through governed delivery stages. The workspace exposes the current stage, its completion evidence and only the next permitted transition.</p></div>
      <div className="vp-toolbar"><Link className="button secondary" href="/workspace/projects">Back to delivery</Link></div>
    </header>

    {query.advanced ? <div className="vp-callout"><strong>Delivery stage advanced</strong><p>The project is now at {projectStageMeta[normaliseProjectStage(query.advanced)].label}.</p></div> : null}
    {query.error ? <div className="vp-callout"><strong>Stage could not be advanced</strong><p>{query.error}</p></div> : null}

    <section className="vp-object vp-object--hero">
      <p className="vp-label">Current delivery stage</p>
      <h2 className="mt-2 text-3xl">{stageMeta.label}</h2>
      <p className="mt-3 max-w-3xl">{stageMeta.objective}</p>
      <div className="vp-compact-metrics mt-6"><div className="vp-metric"><span>Underlying status</span><strong>{workspaceLabel(project.status, 'project')}</strong></div><div className="vp-metric"><span>Next permitted action</span><strong>{stageMeta.action}</strong></div><div className="vp-metric"><span>Due</span><strong>{project.due_date || 'Not set'}</strong></div></div>
    </section>

    <section className="vp-object">
      <p className="vp-label">Delivery progression</p>
      <div className="mt-5 grid gap-3 md:grid-cols-5">{projectStages.map((item,index)=><div key={item} className="border-t border-white/10 pt-3"><strong>{index < stageIndex ? '✓ ' : index === stageIndex ? '● ' : '○ '}{projectStageMeta[item].label}</strong></div>)}</div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <div className="grid gap-5">
        <section className="vp-object"><p className="vp-label">Delivery basis</p><div className="vp-compact-metrics"><div className="vp-metric"><span>Customer</span><strong>{value(lead,'company_name')}</strong></div><div className="vp-metric"><span>Case</span><strong>{value(lead,'title')}</strong></div><div className="vp-metric"><span>Project manager</span><strong>{value(manager,'full_name')}</strong></div></div><div className="mt-6 grid gap-4 md:grid-cols-2"><div><p className="vp-label">Start date</p><p>{project.start_date||'Not set'}</p></div><div><p className="vp-label">Due date</p><p>{project.due_date||'Not set'}</p></div><div><p className="vp-label">Priority</p><p>{value(lead,'priority')}</p></div><div><p className="vp-label">Project type</p><p>{value(lead,'project_type')}</p></div></div>{project.lead_id?<Link className="mt-6 inline-flex font-semibold" href={`/workspace/leads/${project.lead_id}`}>Open source case →</Link>:null}</section>

        <section><div className="vp-section-title"><div><p className="vp-label">Work in progress</p><h2>Delivery activities</h2></div></div><div className="vp-list">{(tasks??[]).length===0?<div className="vp-empty">No delivery activities have been recorded yet.</div>:(tasks??[]).map(task=><div className="vp-row" key={task.id}><div><h3>{task.title}</h3><p>{task.description||'No additional description.'}</p></div><div className="vp-row-status">{workspaceLabel(task.status,'task')}</div><div><strong>{task.due_at?new Date(task.due_at).toLocaleDateString('en-GB'):'No due date'}</strong></div></div>)}</div></section>

        <details className="vp-object"><summary>Project history</summary><div className="mt-5 grid gap-3">{(activity??[]).length===0?<p>No project events recorded.</p>:(activity??[]).map(event=><div key={event.id} className="border-t border-white/10 pt-3"><strong>{event.event_type.replaceAll('_',' ').replaceAll('.',' ')}</strong><p>{new Date(event.created_at).toLocaleString('en-GB')}</p></div>)}</div></details>
      </div>

      <aside className="grid content-start gap-5">
        <section className="vp-object"><p className="vp-label">Stage completion evidence</p><h2 className="mt-2">{stageMeta.completion}</h2><div className="mt-5 grid gap-3">{gates.map(gate=><div key={gate.label} className="flex items-center justify-between border-t border-white/10 pt-3"><span>{gate.label}</span><strong>{gate.met?'Ready':'Missing'}</strong></div>)}</div></section>

        <section className="vp-object"><p className="vp-label">Accepted commercial basis</p>{quote?<><h2 className="mt-2">{value(quote,'quote_number')}</h2><div className="mt-5 grid gap-4"><div><p className="vp-label">Accepted value</p><strong className="text-2xl">{money(quote.total,quote.currency)}</strong></div><div><p className="vp-label">Quote status</p><p>{workspaceLabel(value(quote,'status'),'quote')}</p></div></div></>:<p>No quote is linked to this project.</p>}</section>

        <section className="vp-object"><p className="vp-label">Controlled documents</p><h2 className="mt-2">{(documents??[]).length} linked</h2><p className="mt-2">{approvedDocuments.length} approved · {issuedDocuments.length} issued</p><div className="mt-5 grid gap-3">{(documents??[]).slice(0,5).map(document=><Link key={document.id} href={`/workspace/documents/${document.id}`} className="border-t border-white/10 pt-3"><strong>{document.reference}</strong><p>{document.title}</p></Link>)}</div></section>

        {stageMeta.next ? <form action={advanceProjectStageAction} className="vp-callout"><input type="hidden" name="project_id" value={project.id}/><input type="hidden" name="target_stage" value={stageMeta.next}/><strong>Next permitted transition</strong><p>{stageMeta.action}</p><textarea name="note" rows={3} className="mt-4 w-full rounded-lg border border-white/10 bg-white px-3 py-2 text-black" placeholder="Optional controlled stage note"/><button className="button mt-4">{stageMeta.action}</button>{stage==='internal_review'?<button className="button secondary mt-3" name="target_stage" value="partner_correction">Request partner correction</button>:null}</form> : <section className="vp-callout"><strong>Project closed</strong><p>No further governed delivery transition is required.</p></section>}
      </aside>
    </div>
  </section>;
}
