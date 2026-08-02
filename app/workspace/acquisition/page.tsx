import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listProspects } from '@/lib/repositories/prospects';

const stages = [
  { key: 'identified', label: 'Identified' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'conversation', label: 'Conversation' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'converted', label: 'Converted' },
] as const;

export default async function AcquisitionPage() {
  const { supabase, organisationId } = await requireUserContext();
  const prospects = await listProspects(supabase, organisationId);

  const counts = Object.fromEntries(
    stages.map((stage) => [stage.key, prospects.filter((prospect) => prospect.status === stage.key).length]),
  );
  const linkedInProspects = prospects.filter((prospect) => prospect.source === 'linkedin');

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }}>
        <div>
          <p className="eyebrow">Acquisition</p>
          <h1>Prospects before lead intake</h1>
          <p className="lede">Track LinkedIn and other business-development conversations here. Convert only qualified opportunities into the lead workflow.</p>
        </div>
        <Link className="button" href="/workspace/leads">View leads</Link>
      </div>

      <div className="metric-grid">
        <article className="metric"><span>LinkedIn prospects</span><strong>{linkedInProspects.length}</strong></article>
        <article className="metric"><span>Active conversations</span><strong>{counts.conversation ?? 0}</strong></article>
        <article className="metric"><span>Ready to convert</span><strong>{counts.qualified ?? 0}</strong></article>
      </div>

      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        {stages.map((stage) => (
          <article className="metric" key={stage.key}><span>{stage.label}</span><strong>{counts[stage.key] ?? 0}</strong></article>
        ))}
      </div>

      <div style={{ marginTop: 36 }}>
        <p className="eyebrow">LinkedIn funnel</p>
        <h2>Current conversations</h2>
        {linkedInProspects.length === 0 ? (
          <div className="card" style={{ marginTop: 18, width: '100%' }}>
            <h3>No LinkedIn prospects yet</h3>
            <p className="lede" style={{ fontSize: 16 }}>The repository, validation and server-action backbone is ready for the prospect creation form.</p>
          </div>
        ) : (
          <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
            {linkedInProspects.map((prospect) => (
              <article className="metric" key={prospect.id}>
                <strong style={{ fontSize: 22, marginTop: 0 }}>{prospect.company_name}</strong>
                <p>{[prospect.contact_name, prospect.job_title].filter(Boolean).join(' · ') || 'Contact not added'}</p>
                <span>{prospect.status.replaceAll('_', ' ')}</span>
                {prospect.next_action ? <p>Next: {prospect.next_action}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
