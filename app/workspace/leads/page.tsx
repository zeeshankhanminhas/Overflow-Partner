import LeadForm from '@/components/workspace/LeadForm';
import { requireUserContext } from '@/lib/auth/context';
import { listLeads } from '@/lib/repositories/leads';

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const leads = await listLeads(supabase, organisationId);

  return (
    <section>
      <p className="eyebrow">Lead intake</p>
      <h2>Engineering opportunities</h2>
      <p className="lede">Qualified prospects and direct enquiries enter the engineering-overflow workflow here.</p>

      {params.created ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Lead created successfully.</p> : null}
      {params.converted ? <p className="card" style={{ marginTop: 20, width: '100%' }}>Qualified prospect converted into a lead.</p> : null}
      {params.error ? <p className="card" style={{ marginTop: 20, width: '100%' }}>{String(params.error)}</p> : null}

      <div className="metric-grid">
        <article className="metric"><span>Total leads</span><strong>{leads.length}</strong></article>
        <article className="metric"><span>Technical intake</span><strong>{leads.filter((lead) => lead.status === 'technical_intake').length}</strong></article>
        <article className="metric"><span>Quoted</span><strong>{leads.filter((lead) => lead.status === 'quoted').length}</strong></article>
      </div>

      <LeadForm />

      <div style={{ marginTop: 32, display: 'grid', gap: 12 }}>
        {leads.length === 0 ? (
          <div className="card" style={{ width: '100%' }}><h3>No leads yet</h3><p className="lede" style={{ fontSize: 16 }}>Create a direct lead above or convert a qualified prospect from Acquisition.</p></div>
        ) : leads.map((lead) => (
          <article className="metric" key={lead.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div><strong style={{ marginTop: 0, fontSize: 22 }}>{lead.title || lead.company_name}</strong><p>{lead.company_name}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</p></div>
              <span>{lead.status.replaceAll('_', ' ')}</span>
            </div>
            <p>{lead.source ? `Source: ${lead.source}` : 'Source not recorded'} · Priority: {lead.priority}</p>
            {lead.service ? <p>Service: {lead.service}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
