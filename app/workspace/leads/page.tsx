import Link from 'next/link';
import LeadForm from '@/components/workspace/LeadForm';
import { requireUserContext } from '@/lib/auth/context';
import { listLeads } from '@/lib/repositories/leads';
import { listCompanies } from '@/lib/repositories/companies';
import { listContacts } from '@/lib/repositories/contacts';

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const [leads, companies, contacts] = await Promise.all([listLeads(supabase, organisationId), listCompanies(supabase, organisationId), listContacts(supabase, organisationId)]);
  return (
    <section>
      <p className="eyebrow">Lead 360</p><h1>Governed engineering cases</h1>
      <p className="lede">Each lead is a complete case record containing inherited scope, controlled decisions, partner activity, commercial evidence, documents and audit history.</p>
      {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Lead created successfully.</p> : null}
      {params.converted ? <p className="card" style={{ marginTop: 20, width: '100%', borderLeft: '3px solid var(--accent)' }}>Qualified prospect converted into a governed Lead 360 case.</p> : null}
      {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}
      <div className="metric-grid"><article className="metric"><span>Total cases</span><strong>{leads.length}</strong></article><article className="metric"><span>Technical definition</span><strong>{leads.filter((lead) => ['new','technical_intake'].includes(lead.status)).length}</strong></article><article className="metric"><span>Quoted</span><strong>{leads.filter((lead) => lead.status === 'quoted').length}</strong></article></div>
      <section className="card" style={{ width: '100%', marginTop: 24 }}><p className="eyebrow">Operating principle</p><h3>Open the lead, then complete its next controlled decision</h3><p className="lede" style={{ fontSize: 16 }}>The workflow engine remains underneath the case record. It determines what is complete, what is blocked and what action is permitted next.</p></section>
      {companies.length ? <LeadForm companies={companies} contacts={contacts} /> : <p className="card" style={{ marginTop: 20, width: '100%' }}>Create a company before adding a direct lead. Website prospects create or match the company automatically during conversion.</p>}
      <div style={{ marginTop: 32, display: 'grid', gap: 12 }}>
        {leads.length === 0 ? <div className="card" style={{ width: '100%' }}><h3>No governed cases yet</h3><p>Complete prospect review and conversion, or create a direct lead.</p></div> : leads.map((lead) => (
          <Link href={`/workspace/leads/${lead.id}`} className="metric" key={lead.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><div><p className="eyebrow">Lead 360</p><strong style={{ marginTop: 0, fontSize: 22 }}>{lead.title || lead.company_name}</strong><p>{lead.company_name}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</p></div><span>{lead.status.replaceAll('_', ' ')}</span></div>
            <p>{lead.source ? `Source: ${lead.source}` : 'Source not recorded'} · Priority: {lead.priority}</p><p style={{ marginTop: 12 }}>Open governed case →</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
