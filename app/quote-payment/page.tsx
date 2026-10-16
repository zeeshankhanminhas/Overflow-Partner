import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createStripeCheckout } from './stripe-action';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Secure payment | Overflow Partner', robots: { index: false, follow: false } };

export default async function QuotePaymentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams;
  const access = token ? verifyClientPortalToken(token) : null;
  if (!access) return <main><h1>Payment link unavailable</h1><p>Please request a fresh secure link from Overflow Partner.</p></main>;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <main><h1>Payment temporarily unavailable</h1></main>;
  const db = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: issue } = await db.from('quote_issue_records').select('organisation_id,client_response').eq('quote_id', access.quoteId).eq('quote_revision', access.revision).maybeSingle();
  if (!issue || issue.client_response !== 'accepted') return <main><h1>Quotation acceptance required</h1></main>;
  const { data: quote } = await db.from('quotes').select('id,revision,quote_number,total,currency,valid_until,status').eq('id', access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if (!quote || quote.status !== 'issued' && quote.status !== 'accepted') return <main><h1>Quotation unavailable</h1></main>;
  const { data: payment } = await db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  const { data: release } = await db.from('quote_release_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  const confirmed = Boolean(payment?.confirmed_at || release?.confirmed_at);
  const bankName=process.env.OP_BANK_NAME;
  const bankAccount=process.env.OP_BANK_ACCOUNT_NUMBER;
  const bankSort=process.env.OP_BANK_SORT_CODE;
  const stripeEnabled=Boolean(process.env.STRIPE_SECRET_KEY);
  const amount=new Intl.NumberFormat('en-GB',{style:'currency',currency:String(quote.currency || 'GBP')}).format(Number(quote.total || 0));
  const styles={maxWidth:650,margin:'4rem auto',padding:30,fontFamily:'Arial, sans-serif',border:'1px solid #ddd',borderRadius:12} as const;
  return <main style={styles}>
    <p>OVERFLOW PARTNER · SECURE CLIENT PORTAL</p>
    <h1>{confirmed ? 'Commercial release recorded' : 'Complete your payment'}</h1>
    <p>Quotation {quote.quote_number} · Revision {quote.revision}</p>
    <h2>{amount}</h2>
    <p>Payment method: Stripe or bank transfer only. The agreed quotation terms determine the amount due before work starts.</p>
    {confirmed ? <p>Payment or authorised commercial release has already been recorded. No additional payment is required here.</p> : <>
      <section style={{padding:'16px 0',borderTop:'1px solid #ddd'}}>
        <h3>Pay securely with Stripe</h3>
        {stripeEnabled ? <form action={createStripeCheckout}><input type="hidden" name="token" value={token}/><button style={{padding:'12px 22px',cursor:'pointer'}}>Continue to Stripe Checkout</button></form> : <p>Stripe Checkout is not yet configured. Please use bank transfer or contact OP.</p>}
      </section>
      <section style={{padding:'16px 0',borderTop:'1px solid #ddd'}}>
        <h3>Bank transfer</h3>
        {bankName && bankAccount && bankSort ? <><p>Account name: <strong>{bankName}</strong></p><p>Sort code: <strong>{bankSort}</strong></p><p>Account number: <strong>{bankAccount}</strong></p><p>Payment reference: <strong>{quote.quote_number}</strong></p><p>Your transfer will remain pending until OP verifies cleared funds. Do not send a second payment while verification is pending.</p></> : <p>Bank details will be provided by OP. Please do not transfer funds until you have verified the instructions.</p>}
      </section>
    </>}
  </main>;
}
