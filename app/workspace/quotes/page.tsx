import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listClientQuotes } from '@/lib/repositories/workflow';

function quoteStatus(value: string) {
  const labels: Record<string,string> = {
    draft: 'Draft ready for review',
    internal_review: 'Awaiting internal approval',
    issued: 'Issued to client',
    accepted: 'Accepted by client',
    declined: 'Declined by client',
    expired: 'Expired',
    superseded: 'Superseded',
  };
  return labels[value] || value.replaceAll('_',' ').replace(/\b\w/g,(character)=>character.toUpperCase());
}

function money(currency: string, amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(amount || 0));
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const { supabase, organisationId } = await requireUserContext();
  const quotes = await listClientQuotes(supabase, organisationId) as any[];
  const selected = params.quote ? quotes.find((quote) => quote.id === params.quote) : undefined;

  return <section>
    <div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div><p className="eyebrow">Commercial</p><h1>Client quotes</h1><p className="lede">Controlled quotations generated from approved commercial decisions. No re-keying of lead, price or tax values.</p></div>
      {params.lead ? <Link className="button secondary" href={`/workspace/leads/${params.lead}`}>Back to Lead 360</Link> : null}
    </div>

    {params.created && selected ? <section className="card" style={{marginTop:22,borderLeft:'3px solid var(--accent)'}}>
      <p className="eyebrow">Draft quote generated</p>
      <h2>{selected.quote_number} · Revision {selected.revision}</h2>
      <p>{selected.lead?.company_name || selected.lead?.title || 'Lead'} · {money(selected.currency, selected.total)}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:16,marginTop:18}}>
        <div><p className="eyebrow">Status</p><strong>{quoteStatus(selected.status)}</strong></div>
        <div><p className="eyebrow">Subtotal</p><strong>{money(selected.currency, selected.subtotal)}</strong></div>
        <div><p className="eyebrow">VAT</p><strong>{money(selected.currency, selected.vat)}</strong></div>
        <div><p className="eyebrow">Total</p><strong>{money(selected.currency, selected.total)}</strong></div>
        <div><p className="eyebrow">Valid until</p><strong>{selected.valid_until || 'Not set'}</strong></div>
      </div>
      <p style={{marginTop:18}}>The quote inherited its lead, approved client price, currency and VAT calculation from the commercial decision.</p>
    </section> : null}

    {params.issued && selected ? <p className="card" style={{marginTop:20,borderLeft:'3px solid var(--accent)'}}>Quote {selected.quote_number} has been issued.</p> : null}
    {params.error ? <p className="card" style={{marginTop:20}}>{params.error}</p> : null}

    <div className="metric-grid">
      <article className="metric"><span>Draft</span><strong>{quotes.filter((quote) => quote.status === 'draft').length}</strong></article>
      <article className="metric"><span>Issued</span><strong>{quotes.filter((quote) => quote.status === 'issued').length}</strong></article>
      <article className="metric"><span>Accepted</span><strong>{quotes.filter((quote) => quote.status === 'accepted').length}</strong></article>
    </div>

    <section className="card" style={{marginTop:24}}>
      <p className="eyebrow">Operating rule</p>
      <h3>Quotes are generated, not transcribed</h3>
      <p>Approve the commercial position in Lead 360. The system creates the controlled draft and brings you here to review the result.</p>
    </section>

    <div style={{display:'grid',gap:12,marginTop:28}}>
      {quotes.length === 0 ? <div className="card"><h3>No client quotes yet</h3><p>Complete a partner review and approve the commercial position from Lead 360.</p></div> : quotes.map((quote) =>
        <article className="metric" key={quote.id} style={selected?.id === quote.id ? {borderLeft:'3px solid var(--accent)'} : undefined}>
          <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
            <div><strong>{quote.quote_number} · Revision {quote.revision}</strong><p>{quote.lead?.company_name || quote.lead?.title || 'Lead'}</p></div>
            <span>{quoteStatus(quote.status)}</span>
          </div>
          <p>{money(quote.currency, quote.total)} · valid until {quote.valid_until || 'not set'}</p>
          <Link href={`/workspace/leads/${quote.lead_id}`}>Open Lead 360 →</Link>
        </article>)}
    </div>
  </section>;
}
