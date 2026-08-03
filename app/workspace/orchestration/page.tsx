import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listWorkflowCases } from '@/lib/orchestration/service';
import {
  acceptQuoteAction,
  approveCommercialAction,
  approveIntakeAction,
  createCommercialReviewAction,
  createIntakeShellAction,
} from './actions';

const stages = ['lead', 'technical_intake', 'partner_pricing', 'commercial_review', 'client_quote', 'project'] as const;

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function OrchestrationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const cases = await listWorkflowCases(supabase, organisationId);

  return (
    <section>
      <p className="eyebrow">Operations</p>
      <h1>Workflow Orchestration</h1>
      <p className="lede">
        Enter information once. Advance each requirement through inherited technical, partner,
        commercial, quotation and project stages.
      </p>

      {params.success ? <p className="card" style={{ marginTop: 20 }}>{String(params.success)}</p> : null}
      {params.error ? <p className="card" style={{ marginTop: 20 }}>{String(params.error)}</p> : null}

      <div className="metric-grid">
        {stages.map((stage) => (
          <article className="metric" key={stage}>
            <span>{label(stage)}</span>
            <strong>{cases.filter((item) => item.stage === stage).length}</strong>
          </article>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16, marginTop: 32 }}>
        {cases.length === 0 ? (
          <article className="card">
            <h3>No workflow cases yet</h3>
            <p>Create or receive a lead first. The orchestration layer begins from the lead record.</p>
            <Link href="/workspace/leads">Open leads →</Link>
          </article>
        ) : cases.map((item) => (
          <article className="card" key={item.lead.id} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <p className="eyebrow">{label(item.stage)}</p>
                <h2 style={{ marginTop: 4 }}>{item.lead.title || item.lead.company_name}</h2>
                <p>{item.lead.company_name}{item.lead.contact_name ? ` · ${item.lead.contact_name}` : ''}</p>
                <p>{item.lead.project_type || item.lead.service || 'Engineering requirement'}</p>
              </div>
              <div style={{ minWidth: 240 }}>
                <strong>Next operator decision</strong>
                <p>{item.nextAction}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 20 }}>
              {stages.map((stage) => {
                const currentIndex = stages.indexOf(item.stage);
                const stageIndex = stages.indexOf(stage);
                return (
                  <div className="metric" key={stage} style={{ opacity: stageIndex <= currentIndex ? 1 : 0.45 }}>
                    <span>{label(stage)}</span>
                    <strong style={{ fontSize: 16 }}>{stageIndex < currentIndex ? 'Complete' : stageIndex === currentIndex ? 'Current' : 'Waiting'}</strong>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
              {!item.technicalIntake ? (
                <form action={createIntakeShellAction}>
                  <input type="hidden" name="lead_id" value={item.lead.id} />
                  <button className="button_primary" type="submit">Create inherited intake</button>
                </form>
              ) : null}

              {item.technicalIntake && item.technicalIntake.status !== 'approved' ? (
                <>
                  <Link className="button_secondary" href={`/workspace/leads/${item.lead.id}`}>Review technical scope</Link>
                  <form action={approveIntakeAction}>
                    <input type="hidden" name="intake_id" value={item.technicalIntake.id} />
                    <button className="button_primary" type="submit">Approve technical intake</button>
                  </form>
                </>
              ) : null}

              {item.partnerQuote && !item.commercialReview ? (
                <form action={createCommercialReviewAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                  <input type="hidden" name="partner_quote_id" value={item.partnerQuote.id} />
                  <label>
                    <span style={{ display: 'block', marginBottom: 6 }}>Markup %</span>
                    <input name="markup_percent" type="number" min="0" max="500" step="0.1" defaultValue="30" style={{ maxWidth: 140 }} />
                  </label>
                  <button className="button_primary" type="submit">Generate commercial review</button>
                </form>
              ) : null}

              {item.technicalIntake?.status === 'approved' && !item.partnerQuote ? (
                <Link className="button_primary" href="/workspace/partner-quotes">Select or capture partner price</Link>
              ) : null}

              {item.commercialReview && item.commercialReview.status !== 'approved' && !item.clientQuote ? (
                <form action={approveCommercialAction}>
                  <input type="hidden" name="commercial_review_id" value={item.commercialReview.id} />
                  <button className="button_primary" type="submit">
                    Approve £{Number(item.commercialReview.client_price).toFixed(2)} and generate quote
                  </button>
                </form>
              ) : null}

              {item.clientQuote && !item.project ? (
                <form action={acceptQuoteAction}>
                  <input type="hidden" name="quote_id" value={item.clientQuote.id} />
                  <button className="button_primary" type="submit">Accept quote and create project</button>
                </form>
              ) : null}

              {item.project ? <Link className="button_primary" href="/workspace/projects">Open project</Link> : null}
              <Link className="button_secondary" href={`/workspace/leads/${item.lead.id}`}>Open case record</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
