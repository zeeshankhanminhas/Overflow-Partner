import Link from 'next/link';
import styles from './clientPortal.module.css';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken, createClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createClientResponseToken, type ClientQuoteResponse } from '@/lib/quotes/clientResponseToken';
import { stripeRuntimeMode } from '@/lib/payments/stripeEnvironment';
import { createStripeCheckout } from '@/app/quote-payment/stripe-action';
import { acceptClientQuotationInPortal } from './accept-action';
import { acceptNorthfieldQaCorrection } from './qa-correction-action';
import { isKnownIsolatedQaBackend } from '@/lib/qa/isolation';

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
export default async function ClientPortal({searchParams}:{searchParams:Promise<{token?:string;stripe_return?:string;notice?:string}>}) {
  const { token = '',stripe_return='',notice='' } = await searchParams;
  const access = token ? verifyClientPortalToken(token) : null;
  if (!access) return unavailable();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return unavailable();
  const db = createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue,error:issueError} = await db.from('quote_issue_records').select('organisation_id,quote_id,quote_revision,client_response').eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if (issueError || !issue) return unavailable();
  const {data:quote,error:quoteError} = await db.from('quotes').select('id,organisation_id,lead_id,quote_number,revision,status,subtotal,vat,total,currency,valid_until').eq('id',access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if (quoteError || !quote || !['issued','accepted'].includes(String(quote.status))) return unavailable();
  // The R01 QA history stays immutable. Its VAT correction is a separately
  // acknowledged simulated addendum, never treated as a legal revision.
  const qaReplayEnabled=isKnownIsolatedQaBackend() &&
    quote.id==='c5b894db-ccdd-47e2-a58a-c38005bcaa99';
  const [qaReplayResult,qaAcceptanceResult]=qaReplayEnabled ? await Promise.all([
    db.from('op_qa_northfield_replay').select('correction_text,expires_at')
      .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id)
      .gt('expires_at',new Date().toISOString()).maybeSingle(),
    db.from('op_qa_northfield_addendum_acceptances').select('accepted_at')
      .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
  ]) : [{data:null,error:null},{data:null,error:null}];
  const qaCorrection=qaReplayResult.error?null:qaReplayResult.data;
  const qaCorrectionAcknowledged=!qaAcceptanceResult.error && Boolean(qaAcceptanceResult.data?.accepted_at);

  const [paymentResult,releaseResult,projectResult,contractResult,stripeEvidenceResult] = await Promise.all([
    db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_release_confirmations').select('release_basis,confirmed_at').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    db.from('projects').select('id,project_number,project_stage').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle(),
    process.env.OP_CONTRACTUAL_RELEASE_ENABLED === 'true' ? db.from('quote_release_contracts').select('release_basis,opening_amount,authorised_contact_name,authorised_contact_email').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle() : Promise.resolve({data:null,error:null}),
    db.from('quote_stripe_payment_events').select('stripe_session_id').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).eq('stripe_payment_status','paid').limit(1).maybeSingle(),
  ]);
  // Fail closed on finance errors; never infer that money has arrived.
  const paid = !paymentResult.error && Boolean(paymentResult.data?.confirmed_at);
  const stripePaymentPending = !stripeEvidenceResult.error && Boolean(stripeEvidenceResult.data?.stripe_session_id) && !paid;
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
  const openingPaymentPending=accepted && !paid && !released && !project && !stripePaymentPending && !stripeEvidenceResult.error && !paymentResult.error && !releaseResult.error && !projectResult.error &&
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
          db.from('leads').select('company_name,reference').eq('organisation_id',issue.organisation_id).eq('id',quote.lead_id).maybeSingle(),
          db.from('op_sandbox_payment_authorisations').select('quote_id').eq('organisation_id',issue.organisation_id)
            .eq('quote_id',quote.id).eq('quote_revision',quote.revision).gt('expires_at',new Date().toISOString()).maybeSingle(),
        ]);
        stripeAuthorised=!lead.error&&!authorisation.error&&Boolean(authorisation.data && (
          lead.data?.company_name?.startsWith('OP QA TEST') ||
          (lead.data?.reference==='OP-LEAD-2026-0001' && lead.data?.company_name==='QA - Northfield Demonstration Engineering')
        ));
      }
    }
  }
  const bankReady=process.env.OP_BANK_SETTLEMENT_VERIFICATION_ENABLED==='true' &&
    Boolean(process.env.OP_BANK_NAME&&process.env.OP_BANK_ACCOUNT_NUMBER&&process.env.OP_BANK_SORT_CODE);
  const {data:lineage,error:lineageError}=openingPaymentPending
    ? await db.rpc('op_preproject_lineage_readiness',{
        p_organisation_id:issue.organisation_id,p_quote_id:quote.id,
      })
    : {data:{ready:true},error:null};
  const preprojectReady=!lineageError && lineage?.ready===true;
  const canPay=openingPaymentPending && preprojectReady && stripe_return!=='success' &&
    process.env.OP_PACKAGE01_PAYMENTS_ENABLED==='true' && (stripeAuthorised||bankReady);
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
  // A linked project supersedes the original quotation as the client-facing
  // heading. The quotation remains available as a controlled historic record.
  const projectStage=String(project?.project_stage||'');
  const projectActive=['in_progress','partner_correction'].includes(projectStage);
  const clientStage=projectStage==='ready_for_execution'?'Preparing to start':
    projectActive?'Engineering in progress':
    projectStage==='internal_review'?'Internal quality review':
    ['ready_for_client_issue','issued_to_client','client_review'].includes(projectStage)?'Engineering delivery in review':
    ['completion','closed'].includes(projectStage)?'Delivery and closeout':'Project opened';
  const status = project ? clientStage : paid ? 'Opening payment confirmed' : stripePaymentPending ? 'Payment under verification' : stripe_return==='success' ? 'Checkout completed · verification pending' : released ? 'Commercial release confirmed' : accepted ? 'Quotation accepted' : response === 'declined' ? 'Quotation declined' : response === 'more_time' ? 'More time requested' : 'Awaiting your decision';
  const daysRemaining=dueDate>0?Math.max(0,Math.ceil((dueDate-Date.now())/86400000)):0;
  const expiryText=quote.valid_until?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(quote.valid_until+'T12:00:00Z')):'Not specified';
  return <main className={styles.page}>
    <div className={styles.shell}>
      <div className={styles.brand}><span>OP</span> OVERFLOW PARTNER</div>
      <p className={styles.eyebrow}>SECURE CLIENT PORTAL / {project?'PROJECT':'COMMERCIAL'}</p>
      <h1 className={styles.title}>{project?'Your engineering project.':'Your quotation.'}<br/>One clear next step.</h1>
      <p className={styles.intro}>{project?'Your project is underway. Follow its controlled status here; the original quotation and payment record remain available below.':'A private place to review your commercial position, respond to the quotation and follow the progress of your engineering work.'}</p>
      <section className={styles.panel}>
        <div className={styles.topline}><div><p className={styles.eyebrow}>{project?'PROJECT REFERENCE':'CLIENT QUOTATION'}</p><div className={styles.reference}>{project?project.project_number:quote.quote_number+' · Revision '+quote.revision}</div></div><div><p className={styles.eyebrow}>{project?'ORIGINAL QUOTATION':'VALID UNTIL'}</p><div className={styles.reference}>{project?quote.quote_number+' · Revision '+quote.revision:expiryText}</div><div className={styles.expiry}>{project?'Accepted commercial record preserved':daysRemaining>0?daysRemaining+' day'+(daysRemaining===1?'':'s')+' remaining':'Validity period ended'}</div></div></div>
        <div className={styles.status}><p className={styles.eyebrow}>CURRENT STATUS</p><h2>{status}</h2><p>{project?(projectActive?'The Execution Partner has confirmed commencement. Engineering work is in progress, with controlled review and delivery still to follow.':'Your project has been opened. Delivery and review updates will appear as they are verified.'):released?'The verified contractual release condition has been confirmed.':paid?'Your opening payment has been recorded. Project setup is the next step.':stripePaymentPending?'Stripe payment evidence is verified. We are completing the controlled release and project setup. Please do not pay again.':stripe_return==='success'?'Stripe Checkout has returned successfully, but verified payment evidence has not reached OPOS yet. No project has been created. Please do not pay again.':accepted?'Your quotation has been accepted. The agreed opening payment or release condition must be verified before project setup.':'Review the quotation and record your decision before its expiry.'}</p></div>
        <div className={styles.metrics}><div className={styles.metric}><span className={styles.eyebrow}>QUOTATION TOTAL</span><strong>{displayMoney(Number(quote.total||0),String(quote.currency||'GBP'))}</strong></div><div className={styles.metric}><span className={styles.eyebrow}>COMMERCIAL POSITION</span><strong className={styles.small}>{paid?'Payment confirmed':stripePaymentPending?'Stripe verified · release pending':released?'Release confirmed':accepted?'Awaiting release verification':'Not yet accepted'}</strong></div></div>
        {project?<div className={styles.projectSummary}><div><span className={styles.eyebrow}>PROJECT STATUS</span><h3>{clientStage}</h3><p>Project {project.project_number} · Controlled engineering delivery</p></div><div><span className={styles.eyebrow}>NEXT MILESTONE</span><p>{projectActive?'Engineering submission and internal OP quality review':projectStage==='ready_for_execution'?'Partner commencement confirmation':'Controlled delivery and review update'}</p></div></div>:null}
        {contractResult.data?.release_basis==='purchase_order'?<p className={styles.note}>Agreed release condition: authorised purchase order, subject to verification.</p>:null}
        {contractResult.data?.release_basis==='no_advance_payment'?<p className={styles.note}>Agreed release condition: no advance payment due, subject to authorisation.</p>:null}
        <div className={styles.section}>
          <p className={styles.eyebrow}>QUOTATION · COMMERCIAL SUMMARY</p><h3>Review your quotation and opening amount</h3>
          <p className={styles.note}>Subtotal {displayMoney(Number(quote.subtotal),String(quote.currency||'GBP'))} · VAT {displayMoney(Number(quote.vat),String(quote.currency||'GBP'))} · Total {displayMoney(Number(quote.total),String(quote.currency||'GBP'))}.</p>
          {Number.isFinite(openingAmount)&&openingAmount>0?<p className={styles.note}><strong>Opening payment: {displayMoney(openingAmount,String(quote.currency||'GBP'))}</strong>. Remaining balance: {displayMoney(Number(quote.total)-openingAmount,String(quote.currency||'GBP'))}.</p>:null}
          <p className={styles.note}>Review the scope, assumptions, exclusions and full contractual terms in the approved PDF attached to your quotation email before accepting.</p>
        </div>
        {notice==='acceptance_unavailable'?<p className={styles.note} role="alert">The quotation could not be accepted. Please verify the authorised signatory and current terms. No payment was requested.</p>:null}
        {canDecide?<div className={styles.section}><p className={styles.eyebrow}>STEP 1 · ACCEPT QUOTATION</p><h3>Authorised client acceptance</h3>
          <form action={acceptClientQuotationInPortal} className={styles.acceptanceForm}>
            <input type="hidden" name="token" value={token}/>
            <label>Full name of authorised signatory<input name="signatory_name" minLength={2} required defaultValue={String(contractResult.data?.authorised_contact_name||'')} autoComplete="name"/></label>
            <label>Business email<input name="signatory_email" type="email" required defaultValue={String(contractResult.data?.authorised_contact_email||'')} autoComplete="email"/></label>
            <label className={styles.authorityConfirmation}><input type="checkbox" name="authority_attested" value="yes" required/><span>I am authorised to accept this quotation, including its scope, price and payment terms, on behalf of the client.</span></label>
            <button className={styles.action+' '+styles.primary} type="submit">Accept and continue to opening payment</button>
          </form>
          <div className={styles.actions}>{actions.filter(a=>a.response!=='accepted').map(({label,response})=><Link key={response} className={styles.action} href={`/quote-response?token=${encodeURIComponent(createClientResponseToken({quoteId:quote.id,revision:quote.revision,response,exp:dueDate}))}`}>{label}</Link>)}</div>
        </div>:null}
        {qaCorrection?<div className={styles.section} aria-label="Fictional QA commercial correction">
          <p className={styles.eyebrow}>QA REHEARSAL ONLY · R01 CORRECTION</p>
          <h3>{qaCorrectionAcknowledged?'Historical QA correction · acknowledged':'Confirm corrected VAT-inclusive test terms'}</h3>
          <p className={styles.note}>{qaCorrection.correction_text}</p>
          <p className={styles.note}>This is a simulated amendment for testing the customer journey, not a legally executed variation or a replacement for the historical R01 PDF. The previously accepted quotation remains on record.</p>
          {!qaCorrectionAcknowledged?<form className={styles.acceptanceForm} action={acceptNorthfieldQaCorrection}>
            <input type="hidden" name="token" value={token}/>
            <label>Authorised QA signatory<input name="signatory_name" required defaultValue={String(contractResult.data?.authorised_contact_name||'')}/></label>
            <label>QA contact email<input name="signatory_email" type="email" required defaultValue={String(contractResult.data?.authorised_contact_email||'')}/></label>
            <label className={styles.authorityConfirmation}><input name="qa_correction_acknowledged" type="checkbox" value="yes" required/><span>I acknowledge the corrected VAT-inclusive terms solely for this fictional Northfield QA rehearsal and understand this is not a real payment obligation.</span></label>
            <button className={styles.action+' '+styles.primary} type="submit">Confirm QA terms and continue</button>
          </form>:<p className={styles.note}><strong>Historical QA test acknowledgement recorded.</strong> The existing project remains governed by its recorded commercial evidence; this is not a new payment request.</p>}
          {notice==='qa_addendum_unavailable'?<p role="alert" className={styles.note}>The QA correction could not be recorded. Check the named test contact; no payment has been requested.</p>:null}
        </div>:null}
        {stripePaymentPending?<div className={styles.section}><p className={styles.eyebrow}>PAYMENT EVIDENCE RECEIVED</p><h3>Project setup is being verified</h3><p className={styles.note}>Stripe has confirmed your opening payment. OP is completing the release checks. No additional payment is required. Please check back later.</p></div>:null}
        {stripeEvidenceResult.error?<div className={styles.section}><p className={styles.eyebrow}>FINANCIAL RECORDS TEMPORARILY UNAVAILABLE</p><p className={styles.note}>Payment processing is on hold while we verify the ledger. No additional payment can be requested.</p></div>:null}
        {canPay?<div className={styles.section}><p className={styles.eyebrow}>STEP 2 · OPENING PAYMENT</p>
          <h3>Pay {displayMoney(openingAmount,String(quote.currency||'GBP'))} securely</h3>
          <p className={styles.note}>Your quotation has been accepted. Stripe Checkout opens securely for card entry and returns you to this portal. Project 360 is created only after independently verified payment.</p>
          {stripeAuthorised?<form action={createStripeCheckout}>
            <input type="hidden" name="token" value={token}/>
            <button type="submit" className={styles.action+' '+styles.primary}>Pay {displayMoney(openingAmount,String(quote.currency||'GBP'))} with card</button>
          </form>:bankReady?<Link className={styles.action+' '+styles.primary} href={paymentHref}>View bank transfer instructions</Link>:null}
        </div>:null}
        {stripe_return==='success'&&!paid&&!project?<div className={styles.section} role="status">
          <p className={styles.eyebrow}>STEP 3 · VERIFICATION</p><h3>Checking Stripe payment confirmation</h3>
          <p className={styles.note}>You have returned from Checkout. The independent payment verification is still running. Do not submit another payment.</p>
        </div>:null}
        {openingPaymentPending&&!preprojectReady&&!qaCorrection?<div className={styles.section}><p className={styles.eyebrow}>PRE-PROJECT CONTROL</p><h3>Approval checks in progress</h3><p className={styles.note}>Overflow Partner is verifying the approved engineering and commercial position. No opening payment is requested until the record is ready.</p></div>:null}
        {openingPaymentPending&&preprojectReady&&!canPay&&stripe_return!=='success'?<div className={styles.section}><p className={styles.eyebrow}>OPENING PAYMENT · ARRANGEMENTS PENDING</p><h3>{displayMoney(openingAmount,String(quote.currency||'GBP'))} agreed opening amount</h3><p className={styles.note}>The quotation is accepted, but an authorised payment channel is not yet available for this record. Please contact Overflow Partner for verified payment instructions. No project will be opened from an unverified payment.</p></div>:null}
        {finalReviewAccepted&&!finalSettlementVerified?<div className={styles.section}><h3>Final engineering balance</h3><Link className={styles.action+' '+styles.primary} href={finalBalanceHref}>Pay final balance</Link></div>:null}
        {finalSettlementVerified&&!finalReleaseApproved?<p className={styles.note}>Final payment received. Approved engineering files await Overflow Partner's release authorisation.</p>:null}
        {finalReleaseApproved?<div className={styles.section}><h3>Approved delivery</h3><Link className={styles.action+' '+styles.primary} href={finalFilesHref}>Download approved engineering files</Link></div>:null}
        <p className={styles.note}>Your approved quotation PDF is attached to the original quotation email. For a replacement document or a fresh secure portal link, reply to that email. Keep your private link confidential.</p>
      </section><p className={styles.footer}>OVERFLOW PARTNER · CONTROLLED ENGINEERING DELIVERY</p>
    </div>
  </main>;
}
