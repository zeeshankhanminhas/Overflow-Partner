import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createStripeCheckout } from './stripe-action';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Secure payment | Overflow Partner', robots: { index: false, follow: false } };

export default async function QuotePaymentPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (process.env.OP_PACKAGE01_PAYMENTS_ENABLED !== 'true') return <main><h1>Payment page not yet available</h1></main>;
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
  const {data:contract,error:contractError}=await db.from('quote_release_contracts')
    .select('release_basis,opening_amount').eq('organisation_id',issue.organisation_id)
    .eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
  if(contractError || !contract)return <main><h1>Quotation terms unavailable</h1><p>Contact Overflow Partner to confirm the agreed release conditions.</p></main>;
  if(!['payment','deposit'].includes(String(contract.release_basis)))return <main style={{maxWidth:650,margin:'4rem auto',padding:30}}>
    <h1>No online payment is due</h1><p>Quotation {quote.quote_number} is governed by its agreed
    {contract.release_basis==='purchase_order'?' purchase-order':' no-advance'} release condition.
    Overflow Partner will verify the required authority before mobilisation.</p></main>;
  const { data: payment } = await db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  const { data: release } = await db.from('quote_release_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  const confirmed = Boolean(payment?.confirmed_at || release?.confirmed_at);
  const bankName=process.env.OP_BANK_NAME;
  const bankAccount=process.env.OP_BANK_ACCOUNT_NUMBER;
  const bankSort=process.env.OP_BANK_SORT_CODE;
  const openingAmount = Number(contract.opening_amount);
  const quoteTotal = Number(quote.total);
  if (!Number.isFinite(openingAmount) || openingAmount <= 0 || openingAmount > quoteTotal) {
    return <main><h1>Payment terms need verification</h1><p>Please contact Overflow Partner before making a transfer.</p></main>;
  }
  const formatAmount = (value: number) => new Intl.NumberFormat('en-GB', { style:'currency', currency:String(quote.currency || 'GBP') }).format(value);
  const amount = formatAmount(openingAmount);
  const hasStagedPayment = Math.round(openingAmount * 100) < Math.round(quoteTotal * 100);
  const stripeAvailable = process.env.VERCEL_ENV === 'preview' &&
    process.env.OP_ISOLATED_QA_BACKEND === 'true' &&
    process.env.OP_PACKAGE01_PAYMENTS_ENABLED === 'true' &&
    Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) &&
    (hasStagedPayment ? process.env.OP_STRIPE_DEPOSIT_TEST_ENABLED === 'true' : process.env.OP_STRIPE_FULL_PAYMENT_ONLY === 'true');
  const styles={maxWidth:650,margin:'4rem auto',padding:30,fontFamily:'Arial, sans-serif',border:'1px solid #ddd',borderRadius:12} as const;
  return <main style={styles}>
    <p>OVERFLOW PARTNER · SECURE CLIENT PORTAL</p>
    <h1>{confirmed ? 'Commercial release recorded' : 'Complete your payment'}</h1>
    <p>Quotation {quote.quote_number} · Revision {quote.revision}</p>
    <p>Opening payment due</p><h2>{amount}</h2>
    <p>Total quotation: {formatAmount(quoteTotal)}{hasStagedPayment ? ' · Remaining balance payable before final engineering handover.' : ''}</p>
    <p>Only the agreed opening payment is due now. Do not transfer the full quotation total unless it is explicitly the opening amount in your accepted quotation.</p>
    {confirmed ? <p>Payment or authorised commercial release has already been recorded. No additional payment is required here.</p> : <>
      <section style={{padding:'16px 0',borderTop:'1px solid #ddd'}}>
        <h3>Pay securely with Stripe</h3>
        {stripeAvailable ? <form action={createStripeCheckout}><input type="hidden" name="token" value={token}/><button style={{padding:'12px 22px',cursor:'pointer'}}>Continue to Stripe Checkout</button></form> : <p>{hasStagedPayment ? 'Secure Stripe deposit Checkout is not currently available for this quotation. Please contact Overflow Partner before transferring funds.' : 'Stripe test Checkout is not available for this quotation. Please use bank transfer or contact OP.'}</p>}
      </section>
      <section style={{padding:'16px 0',borderTop:'1px solid #ddd'}}>
        <h3>Bank transfer</h3>
        {bankName && bankAccount && bankSort ? <><p>Account name: <strong>{bankName}</strong></p><p>Sort code: <strong>{bankSort}</strong></p><p>Account number: <strong>{bankAccount}</strong></p><p>Payment reference: <strong>{quote.quote_number}</strong></p><p>Your transfer will remain pending until OP verifies cleared funds. Do not send a second payment while verification is pending.</p></> : <p>Bank details will be provided by OP. Please do not transfer funds until you have verified the instructions.</p>}
      </section>
    </>}
  </main>;
}
