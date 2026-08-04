import Link from 'next/link';
import ProspectForm from '@/components/workspace/ProspectForm';
import { convertProspectFormAction, createStep2InvitationFormAction } from './actions';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';

const stages = [
  { key: 'identified', label: 'Identified' }, { key: 'contacted', label: 'Contacted' },
  { key: 'conversation', label: 'Conversation' }, { key: 'qualified', label: 'Qualified' },
  { key: 'converted', label: 'Converted' },
] as const;

type IntakeSubmission = {
  intake_session_id: string;
  description: string;
  deliverables: string;
  project_type: string;
  discipline: string | null;
  software: string | null;
  drawing_count: number | null;
  source_file_format: string | null;
  required_output_format: string | null;
  deadline: string | null;
  timeline: string | null;
  complexity: string | null;
  files_availability: string | null;
  standards: string | null;
  tolerances: string | null;
  revision_status: string | null;
  special_instructions: string | null;
  submitted_at: string;
};

function dateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : 'Not yet';
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Not specified';
  return String(value);
}

function deliverableItems(value: string | null | undefined) {
  if (!value) return [];
  return value.split(/\r?\n|,\s*/).map((item) => item.trim()).filter(Boolean);
}

function BriefField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div style={{ minWidth: 0 }}>
    <p className="eyebrow" style={{ marginBottom: 5 }}>{label}</p>
    <p style={{ margin: 0, overflowWrap: 'anywhere', color: value ? 'var(--ink)' : 'var(--muted)' }}>{displayValue(value)}</p>
  </div>;
}

function TechnicalBrief({ submission }: { submission: IntakeSubmission }) {
  const deliverables = deliverableItems(submission.deliverables);
  const hasControls = Boolean(submission.standards || submission.tolerances);

  return <section style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <p className="eyebrow">Structured technical brief</p>
        <h3 style={{ marginTop: 6 }}>{submission.discipline || submission.project_type}</h3>
      </div>
      <span style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 10, color: 'var(--muted)', fontSize: 13 }}>
        Submitted {dateTime(submission.submitted_at)}
      </span>
    </div>

    <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18, padding: 18, background: 'var(--paper)', border: '1px solid var(--line)' }}>
      <BriefField label="Discipline" value={submission.discipline} />
      <BriefField label="Software" value={submission.software} />
      <BriefField label="Complexity" value={submission.complexity} />
      <BriefField label="Timeline" value={submission.timeline} />
      <BriefField label="Deadline" value={submission.deadline ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${submission.deadline}T00:00:00`)) : null} />
      <BriefField label="Files available" value={submission.files_availability} />
      <BriefField label="Source format" value={submission.source_file_format} />
      <BriefField label="Primary output" value={submission.required_output_format} />
      <BriefField label="Revision status" value={submission.revision_status} />
      <BriefField label="Drawing count" value={submission.drawing_count} />
    </div>

    <div style={{ marginTop: 20, display: 'grid', gap: 18 }}>
      <div>
        <p className="eyebrow">Deliverables</p>
        {deliverables.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
          {deliverables.map((item) => <span key={item} style={{ border: '1px solid var(--line)', background: 'white', padding: '7px 10px', fontSize: 13 }}>{item}</span>)}
        </div> : <p>Not specified</p>}
      </div>

      <div>
        <p className="eyebrow">Description</p>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{submission.description}</p>
      </div>

      {hasControls ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <div><p className="eyebrow">Standards and specifications</p><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{displayValue(submission.standards)}</p></div>
        <div><p className="eyebrow">Critical tolerances</p><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{displayValue(submission.tolerances)}</p></div>
      </div> : null}

      {submission.special_instructions ? <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 16 }}>
        <p className="eyebrow">Engineering notes</p>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{submission.special_instructions}</p>
      </div> : null}
    </div>
  </section>;
}

export default async function AcquisitionPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>>; }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [prospects, companies, contacts, sessionsResult, submissionsResult] = await Promise.all([
    listProspects(supabase, organisationId),
    listCompanies(supabase, organisationId),
    listContacts(supabase, organisationId),
    supabase.from('intake_sessions')
      .select('id,prospect_id,status,expires_at,sent_at,opened_at,submitted_at')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false }),
    supabase.from('intake_submissions')
      .select('intake_session_id,description,deliverables,project_type,discipline,software,drawing_count,source_file_format,required_output_format,deadline,timeline,complexity,files_availability,standards,tolerances,revision_status,special_instructions,submitted_at')
      .eq('organisation_id', organisationId)
      .order('submitted_at', { ascending: false }),
  ]);

  const sessions = sessionsResult.data || [];
  const submissions = (submissionsResult.data || []) as IntakeSubmission[];
  const sessionByProspect = new Map(sessions.map((session) => [session.prospect_id, session]));
  const submissionBySession = new Map(submissions.map((submission) => [submission.intake_session_id, submission]));
  const counts = Object.fromEntries(stages.map((stage) => [stage.key, prospects.filter((prospect) => prospect.status === stage.key).length]));
  const linkedInProspects = prospects.filter((prospect) => prospect.source === 'linkedin');

  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div><p className="eyebrow">Acquisition</p><h1>Prospects before lead intake</h1>
        <p className="lede">Qualify once, capture the customer&apos;s technical requirement, then convert it into governed lead and technical-intake records without re-entry.</p></div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link className="button secondary" href="/workspace/companies">Add company</Link>
        <Link className="button" href="/workspace/leads">View leads</Link>
      </div>
    </div>
    {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Prospect added successfully.</p> : null}
    {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}
    {params.invitation ? <div className="card" style={{ marginTop: 20, width: '100%' }}><p className="eyebrow">Step 2 invitation ready</p><h3>Secure customer link</h3><p style={{ overflowWrap: 'anywhere' }}>{String(params.invitation)}</p><p>Copy this link into the customer acknowledgement email. Automated delivery will be connected in the Communications Engine.</p></div> : null}
    <div className="metric-grid"><article className="metric"><span>LinkedIn prospects</span><strong>{linkedInProspects.length}</strong></article>
      <article className="metric"><span>Step 2 awaiting customer</span><strong>{sessions.filter((session) => ['invited','opened','in_progress'].includes(session.status)).length}</strong></article>
      <article className="metric"><span>Technical intakes submitted</span><strong>{sessions.filter((session) => session.status === 'submitted').length}</strong></article></div>

    <section className="card" style={{ marginTop: 24, width: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <div>
          <p className="eyebrow">Website prospects</p>
          <h3>Company creation is automatic</h3>
          <p className="lede" style={{ fontSize: 16 }}>Qualify and convert the prospect directly. The conversion transaction will reuse a matching company or create the company master from the prospect name, then create the governed lead.</p>
        </div>
        <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 18 }}>
          <p className="eyebrow">Manual prospect entry</p>
          <h3>Select an existing company first</h3>
          <p className="lede" style={{ fontSize: 16 }}>Manual prospects start from a controlled company record. Add the company once, then select it in the prospect form.</p>
          <Link className="button secondary" href="/workspace/companies" style={{ marginTop: 10 }}>Create company record</Link>
        </div>
      </div>
    </section>

    {companies.length ? <ProspectForm companies={companies} contacts={contacts} /> : <div className="card" style={{ marginTop: 20, width: '100%' }}>
      <p className="eyebrow">Manual prospect entry unavailable</p>
      <h3>Add the first company to enable manual entry</h3>
      <p className="lede" style={{ fontSize: 16 }}>This does not block website prospects from progressing or being converted.</p>
      <Link className="button" href="/workspace/companies">Add first company</Link>
    </div>}

    <div style={{ marginTop: 36 }}><p className="eyebrow">Acquisition funnel</p><h2>Current prospects</h2>
      {prospects.length === 0 ? <div className="card" style={{ marginTop: 18, width: '100%' }}><h3>No prospects yet</h3></div> :
        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>{prospects.map((prospect) => {
          const session = sessionByProspect.get(prospect.id);
          const submission = session ? submissionBySession.get(session.id) : undefined;
          const requirementSummary = (prospect as typeof prospect & { requirement_summary?: string | null }).requirement_summary;
          return <article className="metric" key={prospect.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><div>
              <strong style={{ fontSize: 22, marginTop: 0 }}>{prospect.company_name}</strong>
              <p>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'} · {prospect.source}</p>
            </div><span>{prospect.status.replaceAll('_', ' ')}</span></div>
            {requirementSummary ? <p><strong>Initial requirement:</strong> {requirementSummary}</p> : null}
            {prospect.company_id ? <Link href={`/workspace/companies/${prospect.company_id}`}>Open company 360°</Link> : <p style={{ color: 'var(--muted)' }}><strong>Company master:</strong> Will be created or matched automatically when this prospect is converted.</p>}
            {prospect.next_action ? <p><strong>Next:</strong> {prospect.next_action}</p> : null}
            {session ? <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <p className="eyebrow">Step 2 · {session.status.replaceAll('_', ' ')}</p>
              <p>Sent {dateTime(session.sent_at)} · Opened {dateTime(session.opened_at)} · Submitted {dateTime(session.submitted_at)}</p>
              <small>Expires {dateTime(session.expires_at)}</small>
              {submission ? <TechnicalBrief submission={submission} /> : null}
            </div> : null}
            {!session && prospect.status !== 'converted' ? <form action={createStep2InvitationFormAction} style={{ marginTop: 18 }}>
              <input type="hidden" name="prospect_id" value={prospect.id} />
              <button className="button secondary" type="submit">Create secure Step 2 intake</button>
            </form> : null}
            {prospect.status === 'qualified' ? <form action={convertProspectFormAction} style={{ marginTop: 10 }}>
              <input type="hidden" name="prospect_id" value={prospect.id} />
              <button className="button" type="submit">Convert to lead and create or match company</button>
            </form> : null}
          </article>;
        })}</div>}
    </div>
  </section>;
}
