import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getProjectById } from '@/lib/repositories/workflow';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

function value(record: Record<string, unknown> | null | undefined, key: string, fallback = 'Not recorded') {
  const entry = record?.[key];
  return entry === null || entry === undefined || entry === '' ? fallback : String(entry);
}

function money(amount: unknown, currency: unknown) {
  const number = Number(amount ?? 0);
  try { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: String(currency || 'GBP') }).format(number); }
  catch { return `${String(currency || 'GBP')} ${number.toFixed(2)}`; }
}

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organisationId } = await requireUserContext();

  let project;
  try { project = await getProjectById(supabase, organisationId, id); }
  catch { notFound(); }

  const [{ data: tasks }, { data: documents }, { data: activity }] = await Promise.all([
    supabase.from('tasks').select('*').eq('organisation_id', organisationId).eq('entity_type', 'project').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('documents').select('*').eq('organisation_id', organisationId).eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('activity_events').select('*').eq('organisation_id', organisationId).eq('entity_type', 'project').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
  ]);

  const lead = project.lead as Record<string, unknown> | null | undefined;
  const quote = project.quote as Record<string, unknown> | null | undefined;
  const manager = project.project_manager as Record<string, unknown> | null | undefined;
  const openTasks = (tasks ?? []).filter((task) => !['completed', 'cancelled'].includes(task.status));
  const nextAction = project.status === 'planning'
    ? 'Confirm delivery plan'
    : project.status === 'active'
      ? (openTasks.length ? 'Progress open delivery activities' : 'Add the next delivery activity')
      : project.status === 'review'
        ? 'Complete delivery review'
        : project.status === 'waiting'
          ? 'Resolve the delivery blocker'
          : project.status === 'completed'
            ? 'Prepare controlled completion issue'
            : 'Review project status';

  return <section className="vp-page">
    <header className="vp-header">
      <div>
        <p className="vp-kicker">Project workspace</p>
        <h1>{project.project_number} · {project.title}</h1>
        <p className="vp-subtitle">Accepted work in delivery. The approved case, commercial basis, controlled documents and delivery activity remain connected here.</p>
      </div>
      <div className="vp-toolbar"><Link className="button secondary" href="/workspace/projects">Back to delivery</Link></div>
    </header>

    <section className="vp-object vp-object--hero">
      <p className="vp-label">Current delivery state</p>
      <div className="vp-compact-metrics">
        <div className="vp-metric"><span>Status</span><strong>{workspaceLabel(project.status, 'project')}</strong></div>
        <div className="vp-metric"><span>Next action</span><strong>{nextAction}</strong></div>
        <div className="vp-metric"><span>Due</span><strong>{project.due_date || 'Not set'}</strong></div>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <div className="grid gap-5">
        <section className="vp-object">
          <p className="vp-label">Delivery basis</p>
          <div className="vp-compact-metrics">
            <div className="vp-metric"><span>Customer</span><strong>{value(lead, 'company_name')}</strong></div>
            <div className="vp-metric"><span>Case</span><strong>{value(lead, 'title')}</strong></div>
            <div className="vp-metric"><span>Project manager</span><strong>{value(manager, 'full_name')}</strong></div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div><p className="vp-label">Start date</p><p>{project.start_date || 'Not set'}</p></div>
            <div><p className="vp-label">Due date</p><p>{project.due_date || 'Not set'}</p></div>
            <div><p className="vp-label">Priority</p><p>{value(lead, 'priority')}</p></div>
            <div><p className="vp-label">Project type</p><p>{value(lead, 'project_type')}</p></div>
          </div>
          {project.notes ? <div className="mt-6"><p className="vp-label">Delivery note</p><p>{project.notes}</p></div> : null}
          {project.lead_id ? <Link className="mt-6 inline-flex font-semibold" href={`/workspace/leads/${project.lead_id}`}>Open source case →</Link> : null}
        </section>

        <section>
          <div className="vp-section-title"><div><p className="vp-label">Work in progress</p><h2>Delivery activities</h2></div></div>
          <div className="vp-list">
            {(tasks ?? []).length === 0 ? <div className="vp-empty">No delivery activities have been recorded yet.</div> : (tasks ?? []).map((task) => <div className="vp-row" key={task.id}><div><h3>{task.title}</h3><p>{task.description || 'No additional description.'}</p></div><div className="vp-row-status">{workspaceLabel(task.status, 'task')}</div><div><strong>{task.due_at ? new Date(task.due_at).toLocaleDateString('en-GB') : 'No due date'}</strong></div></div>)}
          </div>
        </section>

        <details className="vp-object">
          <summary>Project history</summary>
          <div className="mt-5 grid gap-3">{(activity ?? []).length === 0 ? <p>No project events recorded.</p> : (activity ?? []).map((event) => <div key={event.id} className="border-t border-white/10 pt-3"><strong>{event.event_type.replaceAll('_', ' ').replaceAll('.', ' ')}</strong><p>{new Date(event.created_at).toLocaleString('en-GB')}</p></div>)}</div>
        </details>
      </div>

      <aside className="grid content-start gap-5">
        <section className="vp-object">
          <p className="vp-label">Accepted commercial basis</p>
          {quote ? <>
            <h2 className="mt-2">{value(quote, 'quote_number')}</h2>
            <div className="mt-5 grid gap-4">
              <div><p className="vp-label">Accepted value</p><strong className="text-2xl">{money(quote.total, quote.currency)}</strong></div>
              <div><p className="vp-label">Quote status</p><p>{workspaceLabel(value(quote, 'status'), 'quote')}</p></div>
              <div><p className="vp-label">Accepted at</p><p>{quote.accepted_at ? new Date(String(quote.accepted_at)).toLocaleString('en-GB') : 'Not recorded'}</p></div>
            </div>
          </> : <p>No quote is linked to this project.</p>}
        </section>

        <section className="vp-object">
          <p className="vp-label">Controlled documents</p>
          <h2 className="mt-2">{(documents ?? []).length} linked</h2>
          <div className="mt-5 grid gap-3">{(documents ?? []).slice(0, 5).map((document) => <Link key={document.id} href={`/workspace/documents/${document.id}`} className="border-t border-white/10 pt-3"><strong>{document.reference}</strong><p>{document.title}</p></Link>)}</div>
          <Link className="mt-5 inline-flex font-semibold" href="/workspace/documents">Open document suite →</Link>
        </section>

        <section className="vp-callout">
          <strong>Next delivery action</strong>
          <p>{nextAction}</p>
          <p className="mt-3">Project creation is no longer the end of the journey. Delivery activity, documents and completion evidence continue from this workspace.</p>
        </section>
      </aside>
    </div>
  </section>;
}
