import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUserContext } from '@/lib/auth/context';
import { getLeadById } from '@/lib/repositories/leads';
import { listTechnicalIntakesForLead } from '@/lib/repositories/technical-intakes';
import TechnicalIntakeForm from '@/components/workspace/TechnicalIntakeForm';

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const { supabase, organisationId } = await requireUserContext();

  let lead;
  try {
    lead = await getLeadById(supabase, organisationId, leadId);
  } catch {
    notFound();
  }

  const intakes = await listTechnicalIntakesForLead(supabase, organisationId, leadId);

  return (
    <section>
      <Link href="/workspace/leads">← Back to leads</Link>
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow">Lead record</p>
          <h1>{lead.title || lead.company_name}</h1>
          <p className="lede">{lead.company_name}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</p>
        </div>
        <span>{lead.status.replaceAll('_', ' ')}</span>
      </div>

      <div className="metric-grid">
        <article className="metric"><span>Source</span><strong style={{ fontSize: 22 }}>{lead.source || 'manual'}</strong></article>
        <article className="metric"><span>Priority</span><strong style={{ fontSize: 22 }}>{lead.priority}</strong></article>
        <article className="metric"><span>Technical intakes</span><strong>{intakes.length}</strong></article>
      </div>

      {lead.notes ? <div className="card" style={{ width: '100%', marginTop: 24 }}><h3>Lead notes</h3><p>{lead.notes}</p></div> : null}

      <div style={{ marginTop: 36 }}>
        <p className="eyebrow">Engineering handoff</p>
        <h2>Technical intake history</h2>
        {intakes.length === 0 ? (
          <p className="lede" style={{ fontSize: 16 }}>No technical intake has been created for this lead yet.</p>
        ) : (
          <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
            {intakes.map((intake) => (
              <article className="metric" key={intake.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <strong style={{ marginTop: 0, fontSize: 22 }}>{intake.project_type || 'Engineering requirement'}</strong>
                    <p>{intake.discipline || 'Discipline not specified'}</p>
                  </div>
                  <span>{intake.status.replaceAll('_', ' ')}</span>
                </div>
                <p>{intake.description}</p>
                {intake.deadline ? <p>Required by: {intake.deadline}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>

      {!['won', 'lost'].includes(lead.status) ? <TechnicalIntakeForm leadId={lead.id} projectType={lead.project_type} /> : null}
    </section>
  );
}
