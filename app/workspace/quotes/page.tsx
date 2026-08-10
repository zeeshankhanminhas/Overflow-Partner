import Link from 'next/link';
import { requireUserContext } from '@/lib/auth/context';
import { listClientQuotes } from '@/lib/repositories/workflow';
import { ProductEmptyState, ProductMetric, ProductMetrics, ProductNotice, ProductPageHeader, ProductRegister, ProductRegisterRow, ProductSectionHeader, ProductStatus, type ProductTone } from '@/components/workspace/ProductUI';

function quoteStatus(value: string) {
  const labels: Record<string,string> = {
    draft: 'Draft', internal_review: 'Internal review', issued: 'Issued', accepted: 'Accepted', declined: 'Declined', expired: 'Expired', superseded: 'Superseded',
  };
  return labels[value] || value.replaceAll('_',' ').replace(/\b\w/g,(character)=>character.toUpperCase());
}
function tone(value:string):ProductTone {
  if(value==='accepted')return 'complete'; if(value==='issued'||value==='internal_review')return 'waiting'; if(value==='declined'||value==='expired')return 'attention'; if(value==='superseded')return 'neutral'; return 'active';
}
function money(currency: string, amount: number) { return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(amount||0)); }

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string,string|undefined>> }) {
  const params=searchParams?await searchParams:{};
  const {supabase,organisationId}=await requireUserContext();
  const quotes=await listClientQuotes(supabase,organisationId) as any[];
  const selected=params.quote?quotes.find(quote=>quote.id===params.quote):undefined;
  const draft=quotes.filter(q=>q.status==='draft'||q.status==='internal_review').length;
  const issued=quotes.filter(q=>q.status==='issued').length;
  const accepted=quotes.filter(q=>q.status==='accepted').length;
  const openValue=quotes.filter(q=>['draft','internal_review','issued'].includes(q.status)).reduce((sum,q)=>sum+Number(q.total||0),0);

  return <section className="vp-page">
    <ProductPageHeader eyebrow="Commercial · Quotes" title="Client quotes" description="Controlled quotations generated from an approved commercial position. Price, tax and customer context stay linked to the Case rather than being re-keyed." backHref={params.lead?`/workspace/leads/${params.lead}`:undefined} backLabel="Back to Case" actions={<Link className="button secondary" href="/workspace/payments">Payments</Link>} />

    {params.created&&selected?<ProductNotice title={`${selected.quote_number} created`} tone="complete"><p>Revision {selected.revision} · {money(selected.currency,selected.total)} · {quoteStatus(selected.status)}</p></ProductNotice>:null}
    {params.issued&&selected?<ProductNotice title={`${selected.quote_number} issued`} tone="complete"><p>The controlled quotation is now recorded as issued to the client.</p></ProductNotice>:null}
    {params.error?<ProductNotice title="Quote action could not be completed" tone="blocked"><p>{params.error}</p></ProductNotice>:null}

    <ProductMetrics label="Quote portfolio summary">
      <ProductMetric label="Draft / review" value={draft} detail="Quotes not yet issued" tone={draft?'waiting':'neutral'} />
      <ProductMetric label="Issued" value={issued} detail="Awaiting client decision" tone={issued?'waiting':'neutral'} />
      <ProductMetric label="Accepted" value={accepted} detail="Client-approved commercial positions" tone={accepted?'complete':'neutral'} />
      <ProductMetric label="Open quote value" value={money('GBP',openValue)} detail="Draft, review and issued value" />
    </ProductMetrics>

    <section className="product-panel">
      <ProductSectionHeader eyebrow="Control rule" title="Quotes are generated from approved commercial data" />
      <p style={{margin:0,color:'var(--saas-muted)',fontSize:12,lineHeight:1.6}}>Approve pricing from the Case. Overflow Partner creates the controlled draft with the customer, currency, pricing and VAT position already attached.</p>
    </section>

    <section>
      <ProductSectionHeader eyebrow="Quote register" title={`${quotes.length} controlled quote${quotes.length===1?'':'s'}`} />
      {quotes.length===0?<ProductEmptyState title="No client quotes yet" description="Complete technical and partner review, then approve the commercial position from the relevant Case." action={<Link className="button secondary" href="/workspace/leads?view=commercial-review">Open commercial review</Link>} />:<ProductRegister>
        {quotes.map(quote=><ProductRegisterRow key={quote.id} href={`/workspace/leads/${quote.lead_id}`} className={selected?.id===quote.id?'is-selected':''}>
          <div><strong>{quote.quote_number} · Rev {quote.revision}</strong><p>{quote.lead?.company_name||quote.lead?.title||'Case'} · valid until {quote.valid_until||'not set'}</p></div>
          <ProductStatus tone={tone(quote.status)}>{quoteStatus(quote.status)}</ProductStatus>
          <div><small>Total</small><strong style={{display:'block',marginTop:3}}>{money(quote.currency,quote.total)}</strong></div>
          <strong>Open Case →</strong>
        </ProductRegisterRow>)}
      </ProductRegister>}
    </section>
  </section>;
}
