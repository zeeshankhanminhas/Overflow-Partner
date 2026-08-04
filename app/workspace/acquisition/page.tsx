import Link from 'next/link';
import ProspectForm from '@/components/workspace/ProspectForm';
import { convertProspectFormAction } from './actions';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';

const stages = [
  { key: 'identified', label: 'Identified' }, { key: 'contacted', label: 'Contacted' },
  { key: 'conversation', label: 'Conversation' }, { key: 'qualified', label: 'Qualified' },
  { key: 'converted', label: 'Converted' },
] as const;

export default async function AcquisitionPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [prospects, companies, contacts] = await Promise.all([
    listProspects(supabase, organisationId), listCompanies(supabase, organisationId), listContacts(supabase, organisationId),
  ]);
  const counts = Object.fromEntries(stages.map((stage) => [stage.key, prospects.filter((prospect) => prospect.status === stage.key).length]));
  const linkedInProspects = prospects.filter((prospect) => prospect.source === 'linkedin');

  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }}>
      <div><p className="eyebrow">Acquisition</p><h1>Prospects before lead intake</h1>
        <p className="lede">Qualify once, then convert the structured requirement into company, contact and governed lead records without re-entry.</p></div>
      <Link className="button" href="/workspace/leads">View leads</Link>
    </div>
    {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Prospect added successfully.</p> : null}
    {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}
    <div className="metric-grid"><article className="metric"><span>LinkedIn prospects</span><strong>{linkedInProspects.length}</strong></article>
      <article className="metric"><span>Active conversations</span><strong>{counts.conversation ?? 0}</strong></article>
      <article className="metric"><span>Ready to convert</span><strong>{counts.qualified ?? 0}</strong></article></div>
    {companies.length ? <ProspectForm companies={companies} contacts={contacts} /> :
      <p className="card" style={{ marginTop: 20, width: '100%' }}>Website prospects can arrive without a company record. Manual prospects require a company first.</p>}

    <div style={{ marginTop: 36 }}><p className="eyebrow">Acquisition funnel</p><h2>Current prospects</h2>
      {prospects.length === 0 ? <div className="card" style={{ marginTop: 18, width: '100%' }}><h3>No prospects yet</h3></div> :
        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>{prospects.map((prospect) => <article className="metric" key={prospect.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><div>
            <strong style={{ fontSize: 22, marginTop: 0 }}>{prospect.company_name}</strong>
            <p>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'} · {prospect.source}</p>
          </div><span>{prospect.status.replaceAll('_', ' ')}</span></div>
          {prospect.company_id ? <Link href={`/workspace/companies/${prospect.company_id}`}>Open company 360°</Link> : null}
          {prospect.next_action ? <p>Next: {prospect.next_action}</p> : null}
          {prospect.status === 'qualified' ? <form action={convertProspectFormAction} style={{ marginTop: 18 }}>
            <input type="hidden" name="prospect_id" value={prospect.id} />
            <button className="button" type="submit">Convert structured requirement to lead</button>
          </form> : null}
        </article>)}</div>}
    </div>
  </section>;
}
