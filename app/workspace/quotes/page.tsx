import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listClientQuotes } from '@/lib/repositories/workflow';
import { resolveQuotePresentation } from '@/lib/presentation/operatingState';
import { ContextActions, InteractionFact, InteractionFacts, WorkspaceDrawer } from '@/components/workspace/InteractionSurface';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus } from '@/components/workspace/ProductUI';

function money(currency: string, amount: number) { return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(amount||0)); }

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const quotes=await listClientQuotes(supabase,organisationId) as any[];
  const selected=params.quote?quotes.find(quote=>quote.id===params.quote):undefined;
  const quoteRows=quotes.map(quote=>({quote,presentation:resolveQuotePresentation(quote.status)}));
  const approval=quoteRows.filter(row=>row.presentation.approval?.required).length;
  const issued=quotes.filter(q=>q.status==='issued').length;
  const accepted=quotes.filter(q=>q.status==='accepted').length;
  const openValue=quotes.filter(q=>['draft','internal_review','issued'].includes(q.status)).reduce((sum,q)=>sum+Number(q.total||0),0);

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Commercial · Quotes" title="Client quotes" description="Inspect quotation state and commercial facts without leaving the register. Open the owning Case only when a governed quote decision or client outcome needs to be performed." backHref={params.lead?`/workspace/leads/${params.lead}`:undefined} backLabel="Back to Case" actions={<><Link className="button secondary" href="/workspace/approvals">Approvals</Link><Link className="button secondary" href="/workspace/payments">Payments</Link></>} />

    {params.created&&selected?<ProductNotice title={`${selected.quote_number} created`} tone="complete"><p>Revision {selected.revision} · {money(selected.currency,selected.total)} · {resolveQuotePresentation(selected.status).state}</p></ProductNotice>:null}
    {params.issued&&selected?<ProductNotice title={`${selected.quote_number} sent`} tone="complete"><p>The controlled quotation is recorded as sent to the client.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Quote action could not be completed" tone="blocked"><p>{params.error}</p></ProductNotice>:null}

    <ProductMetrics label="Quote portfolio summary">
      <ProductMetric label="Approval needed" value={approval} detail="Authority decisions, not general work" tone={approval?'waiting':'complete'} />
      <ProductMetric label="With clients" value={issued} detail="Awaiting client decision" tone={issued?'waiting':'neutral'} />
      <ProductMetric label="Accepted" value={accepted} detail="Client-approved commercial positions" tone={accepted?'complete':'neutral'} />
      <ProductMetric label="Open quote value" value={money('GBP',openValue)} detail="Working, approval and client-waiting value" />
    </ProductMetrics>

    <section className="product-panel">
      <ProductSectionHeader eyebrow="Control rule" title="Quotes inherit the approved commercial position" />
      <p style={{margin:0,color:'var(--saas-muted)',fontSize:12,lineHeight:1.6}}>The Case owns commercial approval. The Client Quote then moves through controlled preparation, issue and client outcome without re-keying the commercial basis.</p>
    </section>

    <section>
      <ProductSectionHeader eyebrow="Quote register" title={`${quotes.length} controlled quote${quotes.length===1?'':'s'}`} />
      {quotes.length===0?<ProductEmptyState title="No Client Quotes yet" description="Complete the technical basis and commercial decision from the relevant Case." action={<Link className="button secondary" href="/workspace/leads?view=commercial-review">Open Cases</Link>} />:<ProductRegister>
        {quoteRows.map(({quote,presentation})=><ProductRegisterRow key={quote.id} className={selected?.id===quote.id?'is-selected':''}>
          <div><strong>{quote.quote_number} · Rev {quote.revision}</strong><p>{quote.lead?.company_name||quote.lead?.title||'Case'} · valid until {quote.valid_until||'not set'}</p><small>{presentation.summary}</small></div>
          <ProductStatus tone={presentation.tone}>{presentation.state}</ProductStatus>
          <div><small>Total</small><strong style={{display:'block',marginTop:3}}>{money(quote.currency,quote.total)}</strong></div>
          <ContextActions label={`Actions for ${quote.quote_number}`}>
            <WorkspaceDrawer triggerLabel="Inspect" eyebrow="Client Quote" title={`${quote.quote_number} · Rev ${quote.revision}`} description={presentation.summary} footer={<Link className="button" href={`/workspace/leads/${quote.lead_id}`}>Open owning Case</Link>}>
              <InteractionFacts>
                <InteractionFact label="Operating state">{presentation.state}</InteractionFact>
                <InteractionFact label="Client">{quote.lead?.company_name||quote.lead?.title||'Case'}</InteractionFact>
                <InteractionFact label="Total">{money(quote.currency,quote.total)}</InteractionFact>
                <InteractionFact label="Valid until">{quote.valid_until||'Not set'}</InteractionFact>
                <InteractionFact label="Next action">{presentation.nextAction.label}</InteractionFact>
                <InteractionFact label="Revision">{quote.revision}</InteractionFact>
              </InteractionFacts>
              <p className="interaction-summary__lead">{presentation.nextAction.reason||presentation.summary}</p>
            </WorkspaceDrawer>
            <Link className="button secondary" href={`/workspace/leads/${quote.lead_id}`}>{presentation.nextAction.kind==='wait'?'Context':'Review'}</Link>
          </ContextActions>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
