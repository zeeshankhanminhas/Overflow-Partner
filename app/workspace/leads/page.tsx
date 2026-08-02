import { requireUserContext } from '@/lib/auth/context';
import { listLeads } from '@/lib/repositories/leads';

export default async function LeadsPage() {
  const { supabase, organisationId } = await requireUserContext();
  const leads = await listLeads(supabase, organisationId);

  return (
    <section>
      <p className="eyebrow">Lead intake</p>
      <h2>Engineering opportunities</h2>
      <p className="lede">Qualified opportunities enter the existing engineering-overflow workflow here.</p>

      <div className="metric-grid">
        <article className="metric"><span>Total leads</span><strong>{leads.length}</strong></article>
        <article className="metric"><span>Technical intake</span><strong>{leads.filter((lead) => lead.status === 'technical_intake').length}</strong></article>
        <article className="metric"><span>Quoted</span><strong>{leads.filter((lead) => lead.status === 'quoted').length}</strong></article>
      </div>

      <div style={{ marginTop: 32, display: 'grid', gap: 12 }}>
        {leads.length === 0 ? (
          <div className="card" style={{ width: '100%' }}>
            <h3>No leads yet</h3>
            <p className="lede" style={{ fontSize: 16 }}>Lead repository, validation and creation actions are ready for the migrated intake UI.</p>
          </div>
        ) : leads.map((lead) => (
          <article className="metric" key={lead.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <strong style={{ marginTop: 0, fontSize: 22 }}>{lead.title || lead.company_name}</strong>
                <p>{lead.company_name}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</p>
              </div>
              <span>{lead.status.replaceAll('_', ' ')}</span>
            </div>
            {lead.service ? <p>Service: {lead.service}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
