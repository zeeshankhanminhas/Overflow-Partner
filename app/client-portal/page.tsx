import Link from 'next/link';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken, createClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createClientResponseToken, type ClientQuoteResponse } from '@/lib/quotes/clientResponseToken';

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
export default async function ClientPortal({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const { token = '' } = await searchParams;
  const access = token ? verifyClientPortalToken(token) : null;
  if (!access) return unavailable();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return unavailable();
  const db = createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue,error:issueError} = await db.from('quote_issue_records').select('organisation_id,quote_id,quote_revision,client_response').eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if (issueError || !issue) return unavailable();
  const {data:quote,error:quoteError} = await db.from('quotes').select('id,organisation_id,quote_number,revision,status,total,currency,valid_until').eq('id',access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if (quoteError || !quote || !['issued','accepted'].includes(String(quote.status))) return unavailable();
  const [paymentResult,releaseResult,projectResult,contractResult] = await Promise.all([
    db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_release_confirmations').select('release_basis,confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('projects').select('project_number').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_release_contracts').select('release_basis,opening_amount').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle(),
  ]);
  // Fail closed on finance errors; never infer that money has arrived.
  const paid = !paymentResult.error && Boolean(paymentResult.data?.confirmed_at);
  const released = !releaseResult.error && Boolean(releaseResult.data?.confirmed_at);
  const project = !projectResult.error ? projectResult.data : null;
  const response = String(issue.client_response || '');
  const accepted = response === 'accepted' || paid || released || Boolean(project);
  const dueDate = quote.valid_until ? new Date(quote.valid_until + 'T23:59:59Z').getTime() : 0;
  const canDecide = !response && dueDate > Date.now() && String(quote.status) === 'issued';
  const actions: {label:string;response:ClientQuoteResponse}[] = [
    {label:'Accept quotation',response:'accepted'}, {label:'Request more time',response:'more_time'}, {label:'Decline quotation',response:'declined'},
  ];
  const canPay = accepted && !paid && !released && !project && !contractResult.error && contractResult.data?.release_basis==='payment' && process.env.OP_PACKAGE01_PAYMENTS_ENABLED === 'true';
  const paymentHref = `/quote-payment?token=${encodeURIComponent(createClientPortalToken(quote.id, quote.revision))}`;
  const status = project ? 'Project opened' : paid ? 'Opening payment confirmed' : released ? 'Commercial release confirmed' : accepted ? 'Quotation accepted' : response === 'declined' ? 'Quotation declined' : response === 'more_time' ? 'More time requested' : 'Awaiting your decision';
  return <main style={{ minHeight:'100vh', background:'#f6f5f2', padding:'24px 16px', fontFamily:'Arial,sans-serif',color:'#1e2926' }}>
    <section style={container}>
      <p style={{...caption,letterSpacing:2,fontWeight:700}}>OVERFLOW PARTNER · CLIENT PORTAL</p>
      <h1 style={{marginBottom:8}}>Your quotation and project</h1>
      <p style={caption}>Quotation {quote.quote_number} · Revision {quote.revision}</p>
      <div style={{padding:20,background:'#f0f4f0',borderRadius:9,margin:'24px 0'}}>
        <p style={{...caption,margin:'0 0 8px'}}>CURRENT STATUS</p>
        <h2 style={{margin:'0 0 8px',fontSize:21}}>{status}</h2>
        <p style={{margin:0,fontSize:14}}>{project ? 'Your project has been opened. We will share delivery details as they are agreed.' : released ? 'The agreed purchase-order or no-advance release condition has been confirmed.' : paid ? 'Your opening payment has been recorded. Project setup is the next step.' : accepted ? 'Thank you for accepting. Overflow Partner will confirm the payment or purchase-order requirements agreed in your quotation.' : 'You can review your quote and respond while it remains valid.'}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:22}}>
        <div style={{border:'1px solid #e5e4df',borderRadius:8,padding:16}}><p style={caption}>Quote total</p><strong style={{fontSize:22}}>{displayMoney(Number(quote.total||0),String(quote.currency||'GBP'))}</strong></div>
        <div style={{border:'1px solid #e5e4df',borderRadius:8,padding:16}}><p style={caption}>Commercial status</p><strong>{paid ? 'Payment confirmed' : released ? (releaseResult.data?.release_basis === 'purchase_order' ? 'Purchase order confirmed' : 'No advance due') : accepted ? 'Awaiting agreed release condition' : 'Not yet accepted'}</strong></div>
      </div>
      {project ? <p><strong>Project reference:</strong> {project.project_number}</p> : null}
      {contractResult.data?.release_basis==='purchase_order' ? <p>Agreed release condition: authorised purchase order, subject to OP verification.</p> : null}
      {contractResult.data?.release_basis==='no_advance_payment' ? <p>Agreed release condition: no advance payment due, subject to OP authorisation.</p> : null}
      {canPay ? <p><Link href={paymentHref}>Continue to payment →</Link></p> : null}
      {canDecide ? <div style={{borderTop:'1px solid #e5e4df',paddingTop:20}}><h2 style={{fontSize:19}}>Respond to your quotation</h2><div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{actions.map(({label,response})=><Link key={response} href={`/quote-response?token=${encodeURIComponent(createClientResponseToken({quoteId:quote.id,revision:quote.revision,response,exp:dueDate}))}`} style={{padding:'12px 16px',borderRadius:8,background:response==='accepted'?'#d74c2c':'#eeede9',color:response==='accepted'?'white':'#172521',textDecoration:'none',fontWeight:600}}>{label}</Link>)}</div></div> : null}
      <p style={{...caption,marginTop:28}}>This page updates as your quotation progresses. Keep your secure link private. For a copy of your approved PDF, payment instructions or a fresh link, reply to the quotation email.</p>
    </section>
  </main>;
}
