import Link from 'next/link';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createClientResponseToken, type ClientQuoteResponse } from '@/lib/quotes/clientResponseToken';
import CheckoutPaymentButton from './CheckoutPaymentButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Client Portal | Overflow Partner', robots: { index: false, follow: false } };
const container = { maxWidth: 760, margin: '48px auto', padding: 28, background: '#fff', border: '1px solid #e2dfd8', borderRadius: 12 } as const;
const caption = { color: '#68665f', fontSize: 14 } as const;
function displayMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(amount); }
  catch { return amount.toFixed(2) + ' ' + currency; }
}
function unavailable() {
  return <main style={{ minHeight: '100vh', background:'#f6f5f2', padding:'24px 16px', fontFamily:'Arial,sans-serif', color:'#1e2926' }}><section style={container}><p style={caption}>OVERFLOW PARTNER · SECURE CLIENT PORTAL</p><h1>Portal access unavailable</h1><p>This link may have expired or been replaced. Please reply to the original quotation email to request a fresh secure link.</p></section></main>;
}
export default async function ClientPortal({searchParams}:{searchParams:Promise<{token?:string;payment?:string}>}) {
  const { token = '', payment: paymentReturn = '' } = await searchParams;
  const access = token ? verifyClientPortalToken(token) : null;
  if (!access) return unavailable();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return unavailable();
  const db = createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue,error:issueError} = await db.from('quote_issue_records').select('organisation_id,quote_id,quote_revision,client_response').eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if (issueError || !issue) return unavailable();
  const {data:quote,error:quoteError} = await db.from('quotes').select('id,organisation_id,quote_number,revision,status,total,currency,valid_until,commercial_review_id').eq('id',access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if (quoteError || !quote || !['issued','accepted'].includes(String(quote.status))) return unavailable();
  const [paymentResult,providerPaymentResult,paymentRequestResult,releaseResult,projectResult] = await Promise.all([
    db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_payment_provider_confirmations').select('paid_at,amount,currency').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_payment_requests').select('status,created_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).order('attempt',{ascending:false}).limit(1).maybeSingle(),
    db.from('quote_release_confirmations').select('release_basis,confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('projects').select('project_number').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
  ]);
  // Fail closed on finance errors; never infer that money has arrived.
  const paid = (!paymentResult.error && Boolean(paymentResult.data?.confirmed_at)) || (!providerPaymentResult.error && Boolean(providerPaymentResult.data?.paid_at));
  const released = !releaseResult.error && Boolean(releaseResult.data?.confirmed_at);
  const project = !projectResult.error ? projectResult.data : null;
  const response = String(issue.client_response || '');
  const accepted = response === 'accepted' || paid || released || Boolean(project);
  const dueDate = quote.valid_until ? new Date(quote.valid_until + 'T23:59:59Z').getTime() : 0;
  const canDecide = !response && dueDate > Date.now() && String(quote.status) === 'issued';
  const actions: {label:string;response:ClientQuoteResponse}[] = [
    {label:'Accept quotation',response:'accepted'}, {label:'Request more time',response:'more_time'}, {label:'Decline quotation',response:'declined'},
  ];
  const status = project ? 'Project opened' : paid ? 'Opening payment confirmed' : released ? 'Commercial release confirmed' : accepted ? 'Quotation accepted' : response === 'declined' ? 'Quotation declined' : response === 'more_time' ? 'More time requested' : 'Awaiting your decision';
  let noAdvanceDue = false;
  if (quote.commercial_review_id) {
    const { data: review } = await db.from('commercial_reviews').select('partner_quote_id').eq('organisation_id', issue.organisation_id).eq('id', quote.commercial_review_id).maybeSingle();
    if (review?.partner_quote_id) {
      const { data: partnerQuote } = await db.from('partner_quotes').select('payment_terms').eq('organisation_id', issue.organisation_id).eq('id', review.partner_quote_id).maybeSingle();
      noAdvanceDue = /no[\s-]+(?:(?:advance[\s-]+)?payments?\s+(?:is\s+)?(?:due|required|requested)|payment\s+is\s+(?:due|required|requested))/i.test(String(partnerQuote?.payment_terms || ''));
    }
  }
  const canPay = accepted && !paid && !released && !project && !noAdvanceDue && response !== 'declined';
  return <main style={{ minHeight:'100vh', background:'#f6f5f2', padding:'24px 16px', fontFamily:'Arial,sans-serif',color:'#1e2926' }}>
    <section style={container}>
      <p style={{...caption,letterSpacing:2,fontWeight:700}}>OVERFLOW PARTNER · CLIENT PORTAL</p>
      <h1 style={{marginBottom:8}}>Your quotation and project</h1>
      <p style={caption}>Quotation {quote.quote_number} · Revision {quote.revision}</p>
      <div style={{padding:20,background:'#f0f4f0',borderRadius:9,margin:'24px 0'}}>
        <p style={{...caption,margin:'0 0 8px'}}>CURRENT STATUS</p>
        <h2 style={{margin:'0 0 8px',fontSize:21}}>{status}</h2>
        <p style={{margin:0,fontSize:14}}>{project ? 'Your project has been opened. We will share delivery details as they are agreed.' : released ? 'The agreed purchase-order or no-advance release condition has been confirmed.' : paid ? 'Your payment has been verified. Overflow Partner will complete the project setup.' : paymentReturn === 'return' ? 'Checkout returned to this page. We are waiting for secure payment confirmation; a return to this page does not count as payment.' : accepted ? 'Thank you for accepting. Complete the required opening payment below before project setup.' : 'You can review your quote and respond while it remains valid.'}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:22}}>
        <div style={{border:'1px solid #e5e4df',borderRadius:8,padding:16}}><p style={caption}>Quote total</p><strong style={{fontSize:22}}>{displayMoney(Number(quote.total||0),String(quote.currency||'GBP'))}</strong></div>
        <div style={{border:'1px solid #e5e4df',borderRadius:8,padding:16}}><p style={caption}>Commercial status</p><strong>{paid ? 'Payment confirmed' : released ? (releaseResult.data?.release_basis === 'purchase_order' ? 'Purchase order confirmed' : 'No advance due') : accepted ? 'Awaiting agreed release condition' : 'Not yet accepted'}</strong></div>
      </div>
      {project ? <p><strong>Project reference:</strong> {project.project_number}</p> : null}
      {canPay ? <section aria-label="Opening payment" style={{ borderTop:'1px solid #e5e4df', paddingTop:20, marginTop:18 }}><h2 style={{fontSize:19}}>Opening payment required</h2><p>Pay the quotation total securely. Your project stays unopened until the payment provider confirms the full amount.</p><CheckoutPaymentButton token={token}/></section> : null}
      {paymentRequestResult.data?.status === 'failed' ? <p role="status">The previous payment attempt did not complete. You can start another secure checkout above.</p> : null}
      {canDecide ? <div style={{borderTop:'1px solid #e5e4df',paddingTop:20}}><h2 style={{fontSize:19}}>Respond to your quotation</h2><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{actions.map(({label,response})=><Link key={response} href={`/quote-response?token=${encodeURIComponent(createClientResponseToken({quoteId:quote.id,revision:quote.revision,response,exp:dueDate}))}`} style={{padding:'12px 16px',borderRadius:8,background:response==='accepted'?'#d74c2c':'#eeede9',color:response==='accepted'?'white':'#172521',textDecoration:'none',fontWeight:600}}>{label}</Link>)}</div></div> : null}
      <p style={{...caption,marginTop:28}}>This page updates as your quotation progresses. Keep your secure link private. A project is not opened until the required release condition has been verified.</p>
    </section>
  </main>;
}
