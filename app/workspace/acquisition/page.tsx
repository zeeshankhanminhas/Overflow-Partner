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

function dateTime(value: string | null) { return value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not yet'; }

export default async function AcquisitionPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>>; }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [prospects, companies, contacts, sessionsResult] = await Promise.all([
    listProspects(supabase, organisationId), listCompanies(supabase, organisationId), listContacts(supabase, organisationId),
    supabase.from('intake_sessions').select('id,prospect_id,status,expires_at,sent_at,opened_at,submitted_at').eq('organisation_id', organisationId).order('created_at', { ascending: false }),
  ]);
  const sessions = sessionsResult.data || [];
  const sessionByProspect = new Map(sessions.map((session) => [session.prospect_id, session]));
  const counts = Object.fromEntries(stages.map((stage) => [stage.key, prospects.filter((prospect) => prospect.status === stage.key).length]));
  const linkedInProspects = prospects.filter((prospect) => prospect.source === 'linkedin');

  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }}>
      <div><p className="eyebrow">Acquisition</p><h1>Prospects before lead intake</h1>
        <p className="lede">Qualify once, capture the customer&apos;s technical requirement, then convert it into governed lead and technical-intake records without re-entry.</p></div>
      <Link className="button" href="/workspace/leads">View leads</Link>
    </div>
    {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Prospect added successfully.</p> : null}
    {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}
    {params.invitation ? <div className="card" style={{ marginTop: 20, width: '100%' }}><p className="eyebrow">Step 2 invitation ready</p><h3>Secure customer link</h3><p style={{ overflowWrap: 'anywhere' }}>{String(params.invitation)}</p><p>Copy this link into the customer acknowledgement email. Automated delivery will be connected in the Communications Engine.</p></div> : null}
    <div className="metric-grid"><article className="metric"><span>LinkedIn prospects</span><strong>{linkedInProspects.length}</strong></article>
      <article className="metric"><span>Step 2 awaiting customer</span><strong>{sessions.filter((session) => ['invited','opened','in_progress'].includes(session.status)).length}</strong></article>
      <article className="metric"><span>Technical intakes submitted</span><strong>{sessions.filter((session) => session.status === 'submitted').length}</strong></article></div>
    {companies.length ? <ProspectForm companies={companies} contacts={contacts} /> : <p className="card" style={{ marginTop: 20, width: '100%' }}>Website prospects can arrive without a company record. Manual prospects require a company first.</p>}

    <div style={{ marginTop: 36 }}><p className="eyebrow">Acquisition funnel</p><h2>Current prospects</h2>
      {prospects.length === 0 ? <div className="card" style={{ marginTop: 18, width: '100%' }}><h3>No prospects yet</h3></div> :
        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>{prospects.map((prospect) => {
          const session = sessionByProspect.get(prospect.id);
          return <article className="metric" key={prospect.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><div>
              <strong style={{ fontSize: 22, marginTop: 0 }}>{prospect.company_name}</strong>
              <p>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'} · {prospect.source}</p>
            </div><span>{prospect.status.replaceAll('_', ' ')}</span></div>
            {prospect.requirement_summary ? <p><strong>Initial requirement:</strong> {prospect.requirement_summary}</p> : null}
            {prospect.company_id ? <Link href={`/workspace/companies/${prospect.company_id}`}>Open company 360°</Link> : null}
            {prospect.next_action ? <p><strong>Next:</strong> {prospect.next_action}</p> : null}
            {session ? <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <p className="eyebrow">Step 2 · {session.status.replaceAll('_', ' ')}</p>
              <p>Sent {dateTime(session.sent_at)} · Opened {dateTime(session.opened_at)} · Submitted {dateTime(session.submitted_at)}</p>
              <small>Expires {dateTime(session.expires_at)}</small>
            </div> : null}
            {!session && prospect.status !== 'converted' ? <form action={createStep2InvitationFormAction} style={{ marginTop: 18 }}>
              <input type="hidden" name="prospect_id" value={prospect.id} />
              <button className="button secondary" type="submit">Create secure Step 2 intake</button>
            </form> : null}
            {prospect.status === 'qualified' ? <form action={convertProspectFormAction} style={{ marginTop: 10 }}>
              <input type="hidden" name="prospect_id" value={prospect.id} />
              <button className="button" type="submit">Convert structured requirement to lead</button>
            </form> : null}
          </article>;
        })}</div>}
    </div>
  </section>;
}
