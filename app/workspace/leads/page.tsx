import Link from 'next/link';
import LeadForm from '@/components/workspace/LeadForm';
import { requireUserContext } from '@/lib/auth/context';
import { listLeads } from '@/lib/repositories/leads';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [leads, companies, contacts] = await Promise.all([
    listLeads(supabase, organisationId),
    listCompanies(supabase, organisationId),
    listContacts(supabase, organisationId),
  ]);
  const openCases = leads.filter((lead) => !['won', 'lost'].includes(lead.status));
  const needDefinition = leads.filter((lead) => ['new', 'technical_intake'].includes(lead.status)).length;
  const quoted = leads.filter((lead) => lead.status === 'quoted').length;

  return <section className="vp-page">
    <header className="vp-header">
      <div><p className="vp-kicker">Cases</p><h1>Engineering work in motion.</h1><p className="vp-subtitle">Open a case to see its current state and complete the one decision that moves it forward.</p></div>
      <div className="vp-toolbar"><details><summary>Exceptional entry</summary><div className="vp-toolbar-panel">{companies.length ? <LeadForm companies={companies} contacts={contacts} /> : <p>Create a company before adding a direct case.</p>}</div></details></div>
    </header>

    {params.created ? <div className="vp-callout"><strong>Case created</strong><p>The direct case is now available below.</p></div> : null}
    {params.converted ? <div className="vp-callout"><strong>Prospect converted</strong><p>The qualified enquiry is now a governed case.</p></div> : null}
    {params.error ? <div className="vp-callout"><strong>Action could not be completed</strong><p>{String(params.error)}</p></div> : null}

    <section className="vp-object vp-object--hero">
      <p className="vp-label">Current workload</p>
      <div className="vp-compact-metrics">
        <div className="vp-metric"><span>Open cases</span><strong>{openCases.length}</strong></div>
        <div className="vp-metric"><span>Need technical definition</span><strong>{needDefinition}</strong></div>
        <div className="vp-metric"><span>Awaiting client outcome</span><strong>{quoted}</strong></div>
      </div>
    </section>

    <section>
      <div className="vp-section-title"><div><p className="vp-label">Primary object</p><h2>Live cases</h2></div></div>
      <div className="vp-list">
        {leads.length === 0 ? <div className="vp-empty">No governed cases yet.</div> : leads.map((lead) =>
          <Link href={`/workspace/leads/${lead.id}`} className="vp-row" key={lead.id}>
            <div><h3>{lead.title || lead.company_name}</h3><p>{lead.company_name}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</p></div>
            <div className="vp-row-status">{workspaceLabel(lead.status, 'lead')}</div>
            <div><strong>Open case →</strong></div>
          </Link>)}
      </div>
    </section>
  </section>;
}
