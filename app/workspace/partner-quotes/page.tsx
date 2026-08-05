import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listPartnerQuotes } from '@/lib/repositories/workflow';
import { createPartnerQuoteFormAction } from '../workflow-actions';
import { workspaceLabel } from '@/lib/presentation/vocabulary';

const input = 'border border-black/15 bg-white px-3 py-2 text-black';

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const reviewsResult = await supabase.from('partner_review_requests')
    .select('id,case_reference,status,lead_id,partner_id,technical_intake_id,partner:partners(id,company_name),lead:leads(id,title,company_name),responses:partner_review_responses(id,revision,pricing_readiness)')
    .eq('organisation_id', organisationId)
    .in('status', ['approved', 'approved_with_conditions'])
    .order('created_at', { ascending: false });

  const schemaReady = !reviewsResult.error;
  const approvedReviews = (reviewsResult.data ?? []) as any[];
  let quotes: any[] = [];
  try { quotes = await listPartnerQuotes(supabase, organisationId) as any[]; } catch { quotes = []; }
  const selectedReview = params.review ? approvedReviews.find((item) => item.id === params.review) : undefined;

  return <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <p className="eyebrow">Partner response</p>
        <h1>Commercial responses</h1>
        <p className="lede">Partner pricing is captured with the technical response. This workspace shows the current commercial position and permits progression only after technical approval.</p>
      </div>
      {params.lead ? <Link className="button secondary" href={`/workspace/leads/${params.lead}`}>Back to Lead 360</Link> : null}
    </div>

    {params.created ? <p className="card">Commercial response recorded.</p> : null}
    {params.error ? <p className="card">{params.error}</p> : null}
    {!schemaReady ? <p className="card" style={{ marginTop: 20, borderLeft: '3px solid #b45309' }}>Partner review schema is unavailable. Commercial progression remains locked.</p> : null}

    <div className="metric-grid">
      <article className="metric"><span>Awaiting response</span><strong>{quotes.filter((quote) => quote.status === 'requested').length}</strong></article>
      <article className="metric"><span>Response received</span><strong>{quotes.filter((quote) => ['received', 'under_review'].includes(quote.status)).length}</strong></article>
      <article className="metric"><span>Selected</span><strong>{quotes.filter((quote) => quote.status === 'selected').length}</strong></article>
    </div>

    {selectedReview ? <form action={createPartnerQuoteFormAction} className="card stack" style={{ marginTop: 24 }}>
      <p className="eyebrow">Exceptional manual capture</p>
      <h3>Record a missing commercial response</h3>
      <p>Use this only where an approved partner response was received outside the secure portal. Normal partner pricing should arrive with the technical review.</p>
      <input type="hidden" name="partner_review_request_id" value={selectedReview.id} />
      <input type="hidden" name="partner_review_response_id" value={selectedReview.responses?.sort((a: any, b: any) => b.revision - a.revision)?.[0]?.id || ''} />
      <input type="hidden" name="partner_id" value={selectedReview.partner_id} />
      <input type="hidden" name="lead_id" value={selectedReview.lead_id} />
      <input type="hidden" name="technical_intake_id" value={selectedReview.technical_intake_id} />
      <input type="hidden" name="status" value="received" />
      <div className="metric"><span>Approved case</span><strong style={{ fontSize: 18 }}>{selectedReview.case_reference} · {selectedReview.partner?.company_name}</strong></div>
      <div className="grid gap-4 md:grid-cols-2">
        <input className={input} name="price" type="number" min="0" step="0.01" placeholder="Partner price" required />
        <input className={input} name="currency" defaultValue="GBP" maxLength={3} required />
        <input className={input} name="lead_time_days" type="number" min="0" placeholder="Lead time days" />
        <input className={input} name="valid_until" type="date" />
        <input className={input} name="quote_reference" placeholder="Partner reference" />
      </div>
      <textarea className={input} name="commercial_assumptions" rows={3} placeholder="Commercial assumptions" />
      <textarea className={input} name="exclusions" rows={3} placeholder="Commercial exclusions" />
      <textarea className={input} name="payment_terms" rows={2} placeholder="Payment terms" />
      <textarea className={input} name="delivery_commitment" rows={2} placeholder="Delivery commitment" />
      <textarea className={input} name="notes" rows={3} placeholder="Internal note" />
      <button className="button">Record received response</button>
    </form> : null}

    <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
      {quotes.length === 0 ? <div className="card"><h3>No commercial responses yet</h3><p>Pricing will appear here when a partner submits the combined technical and commercial review.</p></div> : quotes.map((quote: any) =>
        <article className="metric" key={quote.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div><span>Current status</span><strong style={{ fontSize: 18 }}>{quote.partner?.company_name || 'Execution partner'}</strong></div>
            <strong style={{ fontSize: 16 }}>{workspaceLabel(quote.status, 'partnerQuote')}</strong>
          </div>
          <p>{quote.lead?.title || quote.lead?.company_name || 'Lead'} · {quote.currency} {Number(quote.price).toFixed(2)} · {quote.lead_time_days ?? '—'} days</p>
        </article>)}
    </div>
  </section>;
}
