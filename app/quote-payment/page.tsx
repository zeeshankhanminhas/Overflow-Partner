import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { stripeRuntimeMode } from '@/lib/payments/stripeEnvironment';
import { createStripeCheckout } from './stripe-action';
import css from '@/app/client-portal/clientPortal.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Secure payment | Overflow Partner', robots: { index: false, follow: false } };

function unavailable(title:string,detail='Please contact Overflow Partner for assistance.'){
 return <main className={css.page}><div className={css.shell}><p className={css.brand}><span>◈</span> OVERFLOW PARTNER</p><section className={css.panel}>
   <p className={css.eyebrow}>SECURE CLIENT PORTAL</p><h1 className={css.title}>{title}</h1><p className={css.intro}>{detail}</p>
 </section></div></main>;
}

export default async function QuotePaymentPage({ searchParams }: { searchParams: Promise<{ token?: string; stripe_return?: string }> }) {
  if (process.env.OP_PACKAGE01_PAYMENTS_ENABLED !== 'true') return unavailable('Payment page not yet available','Secure online payment is not currently enabled.');
  const { token = '', stripe_return = '' } = await searchParams;
  const access = token ? verifyClientPortalToken(token) : null;
  if (!access) return unavailable('Payment link unavailable','Please request a fresh secure link from Overflow Partner.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return unavailable('Payment temporarily unavailable');
  const db = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: issue } = await db.from('quote_issue_records').select('organisation_id,client_response').eq('quote_id', access.quoteId).eq('quote_revision', access.revision).maybeSingle();
  if (!issue || issue.client_response !== 'accepted') return unavailable('Quotation acceptance required','Please accept your controlled quotation before proceeding to payment.');
  const { data: quote } = await db.from('quotes').select('id,revision,quote_number,total,currency,valid_until,status').eq('id', access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if (!quote || quote.status !== 'issued' && quote.status !== 'accepted') return unavailable('Quotation unavailable');
  const {data:contract,error:contractError}=await db.from('quote_release_contracts')
    .select('release_basis,opening_amount').eq('organisation_id',issue.organisation_id)
    .eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
  if(contractError || !contract)return unavailable('Quotation terms unavailable','Contact Overflow Partner to confirm the agreed release conditions.');
  if(!['payment','deposit'].includes(String(contract.release_basis)))return unavailable('No online payment is due',`Quotation ${quote.quote_number} is governed by its agreed ${contract.release_basis==='purchase_order'?'purchase-order':'no-advance'} release condition. Overflow Partner will verify the required authority before mobilisation.`);
  // Fail closed on missing financial evidence and an already-created Project.
  // A transient ledger error must never offer a second opening-payment action.
  const [paymentResult,releaseResult,projectResult,stripeEvidenceResult]=await Promise.all([
    db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_release_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('projects').select('id,project_number').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_stripe_payment_events').select('stripe_session_id,verified_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).eq('stripe_payment_status','paid').limit(1).maybeSingle(),
  ]);
  if(paymentResult.error||releaseResult.error||projectResult.error||stripeEvidenceResult.error)
    return unavailable('Payment verification temporarily unavailable','The financial ledger could not be verified. No new payment is requested until this check succeeds.');
  const confirmed = Boolean(paymentResult.data?.confirmed_at || releaseResult.data?.confirmed_at || projectResult.data?.id);
  const verifiedStripeEvent = Boolean(stripeEvidenceResult.data?.stripe_session_id);
  // A verified Stripe event is not the same as a completed financial release.
  // Never offer another Checkout while the original payment awaits reconciliation.
  const settlementPending = !confirmed && verifiedStripeEvent;
  const stripeReturnPending = !confirmed && stripe_return === 'success';
  // Existing verified payments remain visible. Only an unpaid quotation must
  // pass pre-project lineage before any new Stripe or bank-payment invitation.
  if(!confirmed && !settlementPending && !stripeReturnPending){
    const {data:lineage,error:lineageError}=await db.rpc('op_preproject_lineage_readiness',{
      p_organisation_id:issue.organisation_id,p_quote_id:quote.id,
    });
    if(lineageError || lineage?.ready!==true)
      return unavailable('Project readiness verification pending','Our team is completing the approved technical and commercial checks. No payment is requested until those checks are complete.');
  }
  const bankName=process.env.OP_BANK_NAME;
  const bankAccount=process.env.OP_BANK_ACCOUNT_NUMBER;
  const bankSort=process.env.OP_BANK_SORT_CODE;
  const openingAmount = Number(contract.opening_amount);
  const quoteTotal = Number(quote.total);
  if (!Number.isFinite(openingAmount) || openingAmount <= 0 || openingAmount > quoteTotal) {
    return unavailable('Payment terms need verification','Please contact Overflow Partner before making a transfer.');
  }
  const formatAmount = (value: number) => new Intl.NumberFormat('en-GB', { style:'currency', currency:String(quote.currency || 'GBP') }).format(value);
  const amount = formatAmount(openingAmount);
  const hasStagedPayment = Math.round(openingAmount * 100) < Math.round(quoteTotal * 100);
  const paymentMode=stripeRuntimeMode();
  const stripeAvailable=paymentMode==='live' ||
    (paymentMode==='qa' && Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) &&
     (hasStagedPayment ? process.env.OP_STRIPE_DEPOSIT_TEST_ENABLED==='true' :
      process.env.OP_STRIPE_FULL_PAYMENT_ONLY==='true'));
  return <main className={css.page}><div className={css.shell}>
    <p className={css.brand}><span>◈</span> OVERFLOW PARTNER</p>
    <p className={css.eyebrow}>SECURE CLIENT PORTAL / COMMERCIAL SETTLEMENT</p>
    <h1 className={css.title}>{confirmed?'Commercial release recorded':settlementPending?'Payment received · verification pending':stripeReturnPending?'Verifying Stripe payment':'Complete your opening payment'}</h1>
    <p className={css.intro}>Quotation {quote.quote_number} · Revision {quote.revision}</p>
    <section className={css.panel}>
      <div className={css.status}><p className={css.eyebrow}>AGREED OPENING PAYMENT</p><h2>{amount}</h2><p>Total quotation {formatAmount(quoteTotal)}{hasStagedPayment?' · Final balance is payable before native engineering handover.':''}</p></div>
      <p className={css.note}>Only the agreed opening amount is due now. Do not pay the full quotation value unless that is explicitly your accepted opening amount.</p>
      {confirmed?<div className={css.section}><h3>Opening release already recorded</h3><p className={css.note}>{projectResult.data?.id?'A Project record already exists for this quotation.':'Payment or authorised commercial release has already been recorded.'} No additional opening payment is requested here.</p></div>:settlementPending || stripeReturnPending?<div className={css.section}>
        <h3>{settlementPending?'Stripe payment evidence received':'Waiting for Stripe confirmation'}</h3>
        <p className={css.note}>{settlementPending?'Your payment has been verified by Stripe. Our team is completing the controlled financial release and Project setup.':'Stripe has returned you from Checkout. We are waiting for independently verified payment evidence.'} Do not attempt another payment. Refresh this page later to check progress.</p>
      </div>:<>
        <div className={css.section}><h3>Secure card payment</h3>
          {stripeAvailable ? <form action={createStripeCheckout}><input type="hidden" name="token" value={token}/><button type="submit" className={css.action+' '+css.primary}>Continue to Stripe Checkout →</button></form>
            :<p className={css.note}>{hasStagedPayment?'Secure Stripe deposit Checkout is not currently enabled for this quotation.':'Secure online Checkout is not yet enabled.'} Please contact Overflow Partner before transferring funds.</p>}
        </div>
        <div className={css.section}><h3>Bank transfer</h3>
          {process.env.OP_BANK_SETTLEMENT_VERIFICATION_ENABLED==='true'&&bankName&&bankAccount&&bankSort?<>
            <p className={css.note}>Account name: <strong>{bankName}</strong></p><p className={css.note}>Sort code: <strong>{bankSort}</strong></p>
            <p className={css.note}>Account number: <strong>{bankAccount}</strong></p><p className={css.note}>Payment reference: <strong>{quote.quote_number}</strong></p>
            <p className={css.note}>Your transfer remains pending until OP independently verifies cleared funds. Do not make duplicate payments while verification is pending.</p>
          </>:<p className={css.note}>Bank transfer details are available only when independently reconciled settlement verification is enabled. Do not transfer funds until verified instructions are provided.</p>}
        </div>
      </>}
    </section>
    <p className={css.footer}>Controlled quotation · Payment confirmation is not inferred from a checkout visit.</p>
  </div></main>;
}
