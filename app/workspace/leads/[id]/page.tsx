import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import {
  acceptQuoteAction,
  approveCommercialAction,
  approveIntakeAction,
  createCommercialReviewAction,
  createIntakeShellAction,
  issueQuoteAction,
} from '../../orchestration/actions';

const stages = ['lead', 'technical_intake', 'partner_pricing', 'commercial_review', 'client_quote', 'project'] as const;
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const dateTime = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Not recorded';

function RecordField({ label: fieldLabel, value }: { label: string; value: string | number | null | undefined }) {
  return <div><p className="eyebrow" style={{ marginBottom: 5 }}>{fieldLabel}</p><p style={{ margin: 0 }}>{value ?? 'Not recorded'}</p></div>;
}

export default async function Lead360Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const cases = await listWorkflowCases(supabase, organisationId);
  const workflow = cases.find((item) => item.lead.id === id);
  if (!workflow) notFound();

  const [activityResult, documentsResult, tasksResult] = await Promise.all([
    supabase.from('activity_events').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('documents').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('organisation_id', organisationId).eq('entity_type', 'lead').eq('entity_id', id).order('created_at', { ascending: false }),
  ]);
  const activity = activityResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const currentIndex = stages.indexOf(workflow.stage);

  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><p className="eyebrow">Lead 360 · {label(workflow.stage)}</p><h1>{workflow.lead.title || workflow.lead.company_name}</h1>
        <p className="lede">One governed engineering case record from qualified requirement through quotation, project creation and delivery.</p></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Link className="button secondary" href="/workspace/leads">All leads</Link>
        {workflow.lead.company_id ? <Link className="button secondary" href={`/workspace/companies/${workflow.lead.company_id}`}>Company 360°</Link> : null}</div>
    </div>

    {query.success ? <p className="card" style={{ marginTop: 20 }}>{String(query.success)}</p> : null}
    {query.error ? <p className="card" style={{ marginTop: 20 }}>{String(query.error)}</p> : null}

    <section className="card" style={{ width: '100%', marginTop: 24, borderLeft: '3px solid var(--accent)' }}>
      <p className="eyebrow">Next controlled decision</p><h2 style={{ marginTop: 6 }}>{workflow.nextAction}</h2>
      <p>This action is determined by the orchestration engine from the evidence already attached to this lead.</p>
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10, marginTop: 20 }}>
      {stages.map((stage, stageIndex) => <article className="metric" key={stage} style={{ opacity: stageIndex <= currentIndex ? 1 : 0.42 }}>
        <span>{label(stage)}</span><strong style={{ fontSize: 16 }}>{stageIndex < currentIndex ? 'Complete' : stageIndex === currentIndex ? 'Current' : 'Waiting'}</strong>
      </article>)}
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 20, marginTop: 24 }}>
      <div style={{ display: 'grid', gap: 20 }}>
        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Case identity</p><h2>Commercial and engineering context</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, marginTop: 18 }}>
            <RecordField label="Company" value={workflow.lead.company_name} /><RecordField label="Contact" value={workflow.lead.contact_name} />
            <RecordField label="Project type" value={workflow.lead.project_type} /><RecordField label="Service" value={workflow.lead.service} />
            <RecordField label="Priority" value={workflow.lead.priority} /><RecordField label="Source" value={workflow.lead.source} />
          </div>{workflow.lead.notes ? <div style={{ marginTop: 20 }}><p className="eyebrow">Requirement</p><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{workflow.lead.notes}</p></div> : null}
        </section>

        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Governed stage workspace</p><h2>{label(workflow.stage)}</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
            {!workflow.technicalIntake ? <form action={createIntakeShellAction}><input type="hidden" name="lead_id" value={id} /><button className="button" type="submit">Create inherited technical scope</button></form> : null}
            {workflow.technicalIntake && workflow.technicalIntake.status !== 'approved' ? <form action={approveIntakeAction}><input type="hidden" name="intake_id" value={workflow.technicalIntake.id} /><button className="button" type="submit">Approve technical scope</button></form> : null}
            {workflow.technicalIntake?.status === 'approved' && !workflow.partnerQuote ? <Link className="button" href="/workspace/partner-quotes">Capture compliant partner quote</Link> : null}
            {workflow.partnerQuote && !workflow.commercialReview ? <form action={createCommercialReviewAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}><input type="hidden" name="partner_quote_id" value={workflow.partnerQuote.id} /><label><span style={{ display: 'block', marginBottom: 6 }}>Markup %</span><input name="markup_percent" type="number" min="0" max="500" step="0.1" defaultValue="30" style={{ maxWidth: 140 }} /></label><button className="button" type="submit">Create commercial review</button></form> : null}
            {workflow.commercialReview && workflow.commercialReview.status !== 'approved' && !workflow.clientQuote ? <form action={approveCommercialAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}><input type="hidden" name="commercial_review_id" value={workflow.commercialReview.id} /><label><span style={{ display: 'block', marginBottom: 6 }}>Currency</span><input name="currency" defaultValue="GBP" maxLength={3} style={{ maxWidth: 90 }} /></label><label><span style={{ display: 'block', marginBottom: 6 }}>VAT %</span><input name="vat_rate" type="number" min="0" max="100" step="0.1" defaultValue="20" style={{ maxWidth: 100 }} /></label><button className="button" type="submit">Approve and draft quote</button></form> : null}
            {workflow.clientQuote && ['draft', 'internal_review'].includes(workflow.clientQuote.status) && !workflow.project ? <form action={issueQuoteAction}><input type="hidden" name="quote_id" value={workflow.clientQuote.id} /><button className="button" type="submit">Issue client quote</button></form> : null}
            {workflow.clientQuote?.status === 'issued' && !workflow.project ? <form action={acceptQuoteAction}><input type="hidden" name="quote_id" value={workflow.clientQuote.id} /><button className="button" type="submit">Record acceptance and create project</button></form> : null}
            {workflow.project ? <Link className="button" href="/workspace/projects">Open project</Link> : null}
          </div>
        </section>

        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Evidence chain</p><h2>Inherited and generated records</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            <article className="metric"><span>Technical intake</span><strong style={{ fontSize: 18 }}>{workflow.technicalIntake ? label(workflow.technicalIntake.status) : 'Not created'}</strong></article>
            <article className="metric"><span>Partner pricing</span><strong style={{ fontSize: 18 }}>{workflow.partnerQuote ? `${workflow.partnerQuote.currency} ${Number(workflow.partnerQuote.price).toFixed(2)}` : 'Not received'}</strong></article>
            <article className="metric"><span>Commercial review</span><strong style={{ fontSize: 18 }}>{workflow.commercialReview ? label(workflow.commercialReview.status) : 'Not created'}</strong></article>
            <article className="metric"><span>Client quote</span><strong style={{ fontSize: 18 }}>{workflow.clientQuote ? `${workflow.clientQuote.quote_number} · ${label(workflow.clientQuote.status)}` : 'Not generated'}</strong></article>
            <article className="metric"><span>Project</span><strong style={{ fontSize: 18 }}>{workflow.project ? workflow.project.project_number : 'Not created'}</strong></article>
          </div>
        </section>
      </div>

      <aside style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Open actions</p><h3>{tasks.filter((task) => task.status !== 'completed').length} outstanding</h3>
          {tasks.length ? tasks.slice(0, 6).map((task) => <div key={task.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{task.title}</strong><p>{label(task.status)} · {task.priority}</p></div>) : <p>No lead tasks recorded.</p>}
        </section>
        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Documents</p><h3>{documents.length} attached</h3>
          {documents.length ? documents.slice(0, 6).map((document) => <div key={document.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{document.title || document.name || 'Controlled document'}</strong><p>{label(document.status || 'recorded')}</p></div>) : <p>No generated lead documents yet.</p>}
        </section>
        <section className="card" style={{ width: '100%' }}><p className="eyebrow">Unified audit trail</p><h3>Recent case activity</h3>
          {activity.length ? activity.slice(0, 10).map((event) => <div key={event.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}><strong>{label(event.event_type)}</strong><p>{dateTime(event.created_at)}</p></div>) : <p>No lead activity recorded.</p>}
        </section>
      </aside>
    </div>
  </section>;
}
