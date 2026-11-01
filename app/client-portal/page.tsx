import Link from 'next/link';
import styles from './clientPortal.module.css';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken, createClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createClientResponseToken, type ClientQuoteResponse } from '@/lib/quotes/clientResponseToken';
import { stripeRuntimeMode } from '@/lib/payments/stripeEnvironment';

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
  const {data:quote,error:quoteError} = await db.from('quotes').select('id,organisation_id,lead_id,quote_number,revision,status,total,currency,valid_until').eq('id',access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if (quoteError || !quote || !['issued','accepted'].includes(String(quote.status))) return unavailable();
  const [paymentResult,releaseResult,projectResult,contractResult] = await Promise.all([
    db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_release_confirmations').select('release_basis,confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('projects').select('id,project_number').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    process.env.OP_CONTRACTUAL_RELEASE_ENABLED === 'true' ? db.from('quote_release_contracts').select('release_basis,opening_amount').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle() : Promise.resolve({data:null,error:null}),
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
  const openingAmount=Number(contractResult.data?.opening_amount);
  const openingPaymentPending=accepted && !paid && !released && !project && !paymentResult.error && !releaseResult.error && !projectResult.error &&
    !contractResult.error && ['payment','deposit'].includes(String(contractResult.data?.release_basis)) &&
    Number.isFinite(openingAmount) && openingAmount>0 && openingAmount<=Number(quote.total);
  const stripeMode=stripeRuntimeMode();
  const staged=Math.round(openingAmount*100)<Math.round(Number(quote.total)*100);
  const stripeConfigured=stripeMode==='live' ||
    (stripeMode==='qa' && Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) &&
      (staged?process.env.OP_STRIPE_DEPOSIT_TEST_ENABLED==='true':process.env.OP_STRIPE_FULL_PAYMENT_ONLY==='true'));
  let stripeAuthorised=false;
  if(openingPaymentPending&&stripeConfigured){
    const signatory=await db.from('quote_client_signatory_attestations').select('quote_id')
      .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
    if(!signatory.error&&signatory.data){
      if(stripeMode==='live')stripeAuthorised=true;
      else if(stripeMode==='qa'){
        const [lead,authorisation]=await Promise.all([
          db.from('leads').select('company_name').eq('organisation_id',issue.organisation_id).eq('id',quote.lead_id).maybeSingle(),
          db.from('op_sandbox_payment_authorisations').select('quote_id').eq('organisation_id',issue.organisation_id)
            .eq('quote_id',quote.id).eq('quote_revision',quote.revision).gt('expires_at',new Date().toISOString()).maybeSingle(),
        ]);
        stripeAuthorised=!lead.error&&!authorisation.error&&Boolean(lead.data?.company_name?.startsWith('OP QA TEST')&&authorisation.data);
      }
    }
  }
  const bankReady=process.env.OP_BANK_SETTLEMENT_VERIFICATION_ENABLED==='true' &&
    Boolean(process.env.OP_BANK_NAME&&process.env.OP_BANK_ACCOUNT_NUMBER&&process.env.OP_BANK_SORT_CODE);
  const canPay=openingPaymentPending && process.env.OP_PACKAGE01_PAYMENTS_ENABLED==='true' && (stripeAuthorised||bankReady);
  const paymentHref = `/quote-payment?token=${encodeURIComponent(createClientPortalToken(quote.id, quote.revision))}`;
  let finalReviewAccepted=false;
  let finalSettlementVerified=false;
  let finalReleaseApproved=false;
  if(project?.id && process.env.OP_VOICE_FINAL_RELEASE_ENABLED==='true'){
    const [review,settled,releaseApproval]=await Promise.all([
      db.from('project_client_reviews').select('outcome')
        .eq('organisation_id',issue.organisation_id).eq('project_id',project.id)
        .order('recorded_at',{ascending:false}).limit(1).maybeSingle(),
      db.from('op_project_final_settlements').select('project_id,verified_at')
        .eq('organisation_id',issue.organisation_id).eq('project_id',project.id).maybeSingle(),
      db.from('op_project_final_release_approvals').select('project_id,approved_at')
        .eq('organisation_id',issue.organisation_id).eq('project_id',project.id).maybeSingle(),
    ]);
    finalReviewAccepted=!review.error && ['accepted','accepted_with_comments'].includes(String(review.data?.outcome));
    finalSettlementVerified=!settled.error && Boolean(settled.data?.verified_at);
    finalReleaseApproved=!releaseApproval.error && Boolean(releaseApproval.data?.approved_at) && finalSettlementVerified;
  }
  const finalBalanceHref='/project-final-payment?token='+encodeURIComponent(createClientPortalToken(quote.id,quote.revision));
  const finalFilesHref='/client-final-files?token='+encodeURIComponent(createClientPortalToken(quote.id,quote.revision));
  const status = project ? 'Project opened' : paid ? 'Opening payment confirmed' : released ? 'Commercial release confirmed' : accepted ? 'Quotation accepted' : response === 'declined' ? 'Quotation declined' : response === 'more_time' ? 'More time requested' : 'Awaiting your decision';
  const daysRemaining=dueDate>0?Math.max(0,Math.ceil((dueDate-Date.now())/86400000)):0;
  const expiryText=quote.valid_until?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(quote.valid_until+'T12:00:00Z')):'Not specified';
  return <main className={styles.page}>
    <div className={styles.shell}>
      <div className={styles.brand}><span>OP</span> OVERFLOW PARTNER</div>
      <p className={styles.eyebrow}>SECURE CLIENT PORTAL / COMMERCIAL</p>
      <h1 className={styles.title}>Your quotation.<br/>One clear next step.</h1>
      <p className={styles.intro}>A private place to review your commercial position, respond to the quotation and follow the progress of your engineering work.</p>
      <section className={styles.panel}>
        <div className={styles.topline}><div><p className={styles.eyebrow}>CLIENT QUOTATION</p><div className={styles.reference}>{quote.quote_number} · Revision {quote.revision}</div></div><div><p className={styles.eyebrow}>VALID UNTIL</p><div className={styles.reference}>{expiryText}</div><div className={styles.expiry}>{daysRemaining>0?daysRemaining+' day'+(daysRemaining===1?'':'s')+' remaining':'Validity period ended'}</div></div></div>
        <div className={styles.status}><p className={styles.eyebrow}>CURRENT STATUS</p><h2>{status}</h2><p>{project?'Your project has been opened. We will share delivery details as they are agreed.':released?'The verified contractual release condition has been confirmed.':paid?'Your opening payment has been recorded. Project setup is the next step.':accepted?'Your quotation has been accepted. The agreed opening payment or release condition must be verified before project setup.':'Review the quotation and record your decision before its expiry.'}</p></div>
        <div className={styles.metrics}><div className={styles.metric}><span className={styles.eyebrow}>QUOTATION TOTAL</span><strong>{displayMoney(Number(quote.total||0),String(quote.currency||'GBP'))}</strong></div><div className={styles.metric}><span className={styles.eyebrow}>COMMERCIAL POSITION</span><strong className={styles.small}>{paid?'Payment confirmed':released?'Release confirmed':accepted?'Awaiting release verification':'Not yet accepted'}</strong></div></div>
        {project?<div className={styles.section}><h3>Project reference</h3><p>{project.project_number}</p></div>:null}
        {contractResult.data?.release_basis==='purchase_order'?<p className={styles.note}>Agreed release condition: authorised purchase order, subject to verification.</p>:null}
        {contractResult.data?.release_basis==='no_advance_payment'?<p className={styles.note}>Agreed release condition: no advance payment due, subject to authorisation.</p>:null}
        {canDecide?<div className={styles.section}><p className={styles.eyebrow}>YOUR NEXT ACTION</p><h3>Respond to your quotation</h3><div className={styles.actions}>{actions.map(({label,response})=><Link key={response} className={styles.action+' '+(response==='accepted'?styles.primary:'')} href={`/quote-response?token=${encodeURIComponent(createClientResponseToken({quoteId:quote.id,revision:quote.revision,response,exp:dueDate}))}`}>{label}</Link>)}</div></div>:null}
        {canPay?<div className={styles.section}><p className={styles.eyebrow}>NEXT STEP</p><h3>Opening payment</h3><p className={styles.note}>Project mobilisation begins only after the agreed payment has been verified.</p><Link className={styles.action+' '+styles.primary} href={paymentHref}>Continue to payment</Link></div>:null}
        {openingPaymentPending&&!canPay?<div className={styles.section}><p className={styles.eyebrow}>OPENING PAYMENT · ARRANGEMENTS PENDING</p><h3>{displayMoney(openingAmount,String(quote.currency||'GBP'))} agreed opening amount</h3><p className={styles.note}>The quotation is accepted, but an authorised payment channel is not yet available for this record. Please contact Overflow Partner for verified payment instructions. No project will be opened from an unverified payment.</p></div>:null}
        {finalReviewAccepted&&!finalSettlementVerified?<div className={styles.section}><h3>Final engineering balance</h3><Link className={styles.action+' '+styles.primary} href={finalBalanceHref}>Pay final balance</Link></div>:null}
        {finalSettlementVerified&&!finalReleaseApproved?<p className={styles.note}>Final payment received. Approved engineering files await Overflow Partner's release authorisation.</p>:null}
        {finalReleaseApproved?<div className={styles.section}><h3>Approved delivery</h3><Link className={styles.action+' '+styles.primary} href={finalFilesHref}>Download approved engineering files</Link></div>:null}
        <p className={styles.note}>Your approved quotation PDF is attached to the original quotation email. For a replacement document or a fresh secure portal link, reply to that email. Keep your private link confidential.</p>
      </section><p className={styles.footer}>OVERFLOW PARTNER · CONTROLLED ENGINEERING DELIVERY</p>
    </div>
  </main>;
}
