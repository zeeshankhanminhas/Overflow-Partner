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

function formatDate(input: unknown, fallback = 'Not set') {
  if (!input) return fallback;
  const date = new Date(String(input));
  return Number.isNaN(date.getTime()) ? String(input) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const taskRows = tasks ?? [];
  const documentRows = documents ?? [];
  const openTasks = taskRows.filter((task) => !['completed', 'cancelled'].includes(task.status));
  const approvedDocuments = documentRows.filter((document) => ['approved','issued'].includes(document.status));
  const issuedDocuments = documentRows.filter((document) => document.status === 'issued');
  const scopeDocument = documentRows.find((document) => String(document.title || '').toLowerCase().includes('scope'));

  const readiness = [
    { label: 'Accepted quote linked', detail: quote ? `${value(quote,'quote_number')} · ${money(quote.total, quote.currency)}` : 'No accepted quote linked', met: Boolean(project.quote_id), action: project.lead_id ? `/workspace/leads/${project.lead_id}` : null, actionLabel: 'Open case' },
    { label: 'Project manager assigned', detail: value(manager, 'full_name'), met: Boolean(manager?.full_name), action: '/workspace/settings', actionLabel: 'Assign owner' },
    { label: 'Start date recorded', detail: formatDate(project.start_date), met: Boolean(project.start_date), action: null, actionLabel: 'Set start date' },
    { label: 'Due date recorded', detail: formatDate(project.due_date), met: Boolean(project.due_date), action: null, actionLabel: 'Set due date' },
    { label: 'Scope of Work available', detail: scopeDocument ? `${scopeDocument.reference} · ${workspaceLabel(scopeDocument.status,'document')}` : 'Not generated', met: Boolean(scopeDocument), action: project.lead_id ? `/workspace/leads/${project.lead_id}` : null, actionLabel: 'Generate' },
  ];

  const mobilisationReady = readiness.every((item) => item.met);
  const stageCanAdvance = stage === 'mobilisation' ? mobilisationReady : true;
  const missingCount = readiness.filter((item) => !item.met).length;

  return <section className="project-os-page">
    <header className="project-os-header">
      <div>
        <Link href="/workspace/projects" className="project-os-back">← Back to projects</Link>
        <p className="project-os-reference">{project.project_number}</p>
        <h1>{project.title}</h1>
        <div className="project-os-meta">
          <span>Project workspace</span>
          <span>Created {formatDate(project.created_at)}</span>
          <span>Last updated {formatDate(project.updated_at)}</span>
        </div>
      </div>
      <section className="project-os-stage-card">
        <p>Current stage</p>
        <h2>{stageMeta.label}</h2>
        <span className="project-os-health"><i /> On track</span>
        <div><small>Stage started</small><strong>{formatDate(project.updated_at || project.created_at)}</strong></div>
      </section>
    </header>

    {query.advanced ? <div className="project-os-notice success"><strong>Delivery stage advanced</strong><span>The project is now at {projectStageMeta[normaliseProjectStage(query.advanced)].label}.</span></div> : null}
    {query.error ? <div className="project-os-notice error"><strong>Stage could not be advanced</strong><span>{query.error}</span></div> : null}

    <section className="project-os-progress-card">
      <p className="project-os-section-label">Delivery progression</p>
      <div className="project-os-progress-scroll">
        <ol className="project-os-progress" aria-label="Project delivery progression">
          {projectStages.map((item,index) => {
            const state = index < stageIndex ? 'complete' : index === stageIndex ? 'current' : 'future';
            return <li key={item} className={state}>
              <div className="project-os-node"><span>{index + 1}</span></div>
              <strong>{projectStageMeta[item].label}</strong>
              {state === 'current' ? <small>Current</small> : null}
            </li>;
          })}
        </ol>
      </div>
      <div className="project-os-progress-footer">
        <p>{stageMeta.objective}</p>
        <button type="button" className="button secondary">View full delivery path</button>
      </div>
    </section>

    <div className="project-os-decision-grid">
      <section className="project-os-panel project-os-readiness">
        <p className="project-os-section-label">Stage readiness</p>
        <div className="project-os-checklist">
          {readiness.map((item) => <div className="project-os-check-row" key={item.label}>
            <span className={`project-os-check-icon ${item.met ? 'ready' : 'missing'}`}>{item.met ? '✓' : '!'}</span>
            <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            <span className={item.met ? 'project-os-ready' : 'project-os-missing'}>{item.met ? 'Ready' : 'Missing'}</span>
            {item.action ? <Link href={item.action} aria-label={item.actionLabel}>›</Link> : <span>›</span>}
          </div>)}
        </div>
        {missingCount > 0 ? <div className="project-os-blocker">
          <div><strong>{missingCount} requirement{missingCount === 1 ? '' : 's'} missing</strong><p>Add the missing information to enable the next action.</p></div>
          <Link className="button secondary" href={project.lead_id ? `/workspace/leads/${project.lead_id}` : '/workspace/projects'}>Resolve blockers</Link>
        </div> : null}
      </section>

      <section className="project-os-panel project-os-action-panel">
        <p className="project-os-section-label">Next permitted action</p>
        <div className="project-os-action-icon">→</div>
        <h2>{stageMeta.action}</h2>
        <p>This will move the project to the next stage:</p>
        <strong>{stageMeta.next ? projectStageMeta[stageMeta.next].label : 'Closed'}</strong>
        {!stageCanAdvance ? <small>Action will be available when all requirements are ready.</small> : <small>All required evidence is ready.</small>}
        {stageMeta.next ? <form action={advanceProjectStageAction}>
          <input type="hidden" name="project_id" value={project.id}/>
          <input type="hidden" name="target_stage" value={stageMeta.next}/>
          <button className="button" disabled={!stageCanAdvance}>{stageMeta.action}</button>
          {stage === 'internal_review' ? <button className="button secondary" name="target_stage" value="partner_correction">Request partner correction</button> : null}
        </form> : null}
        <button type="button" className="button secondary">Preview stage checklist</button>
      </section>

      <section className="project-os-panel project-os-summary">
        <p className="project-os-section-label">Project summary</p>
        <dl>
          <div><dt>Customer</dt><dd>{value(lead,'company_name')}</dd></div>
          <div><dt>Case</dt><dd>{value(lead,'title')}</dd></div>
          <div><dt>Project type</dt><dd>{value(lead,'project_type')}</dd></div>
          <div><dt>Priority</dt><dd><span className="project-os-priority-dot" /> {value(lead,'priority')}</dd></div>
          <div><dt>Commercial value</dt><dd>{quote ? money(quote.total,quote.currency) : 'Not recorded'}</dd></div>
          <div><dt>Quote status</dt><dd><span className="project-os-status-dot" /> {quote ? workspaceLabel(value(quote,'status'),'quote') : 'Not recorded'}</dd></div>
        </dl>
        {project.lead_id ? <Link href={`/workspace/leads/${project.lead_id}`}>Open source case →</Link> : null}
      </section>
    </div>

    <div className="project-os-lower-grid">
      <section className="project-os-panel project-os-documents">
        <div className="project-os-panel-heading"><p className="project-os-section-label">Controlled documents</p><Link href="/workspace/documents">View all documents</Link></div>
        <div className="project-os-document-list">
          {documentRows.length === 0 ? <div className="project-os-empty-row"><span>▤</span><div><strong>No documents generated</strong><small>Generate the first controlled project document.</small></div></div> : documentRows.slice(0,5).map((document) => <div className="project-os-document-row" key={document.id}>
            <span className="project-os-doc-icon">▤</span>
            <div><strong>{document.title}</strong><small>{document.reference}</small></div>
            <span className="project-os-tag">{workspaceLabel(document.status,'document')}</span>
            <small>{formatDate(document.created_at)}</small>
            <Link className="button secondary" href={`/workspace/documents/${document.id}`}>Open</Link>
          </div>)}
        </div>
        <p className="project-os-help">Documents shown are relevant to the current stage.</p>
      </section>

      <section className="project-os-panel project-os-activities">
        <div className="project-os-panel-heading"><p className="project-os-section-label">Delivery activities</p><span>{taskRows.length ? `${taskRows.length} activities` : ''}</span></div>
        {taskRows.length === 0 ? <div className="project-os-empty-state"><span>▣</span><strong>No activities yet</strong><p>Create the first activity to plan and track delivery work.</p><Link className="button secondary" href="/workspace/projects">Add activity</Link></div> : <div className="project-os-activity-list">{taskRows.slice(0,5).map((task) => <div key={task.id}><strong>{task.title}</strong><small>{workspaceLabel(task.status,'task')} · {task.due_at ? formatDate(task.due_at) : 'No due date'}</small></div>)}</div>}
      </section>
    </div>

    <section className="project-os-panel project-os-history">
      <p className="project-os-section-label">Project history</p>
      <div>{(activity ?? []).length === 0 ? <p>No project events recorded.</p> : (activity ?? []).slice(0,8).map((event) => <div className="project-os-history-row" key={event.id}><span>→</span><div><strong>{event.event_type.replaceAll('_',' ').replaceAll('.',' ')}</strong><small>{formatDate(event.created_at)}</small></div></div>)}</div>
    </section>
  </section>;
}
