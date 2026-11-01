import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {requireUserContext,assertRole} from '@/lib/auth/context';
import {isKnownIsolatedQaBackend} from '@/lib/qa/isolation';
import {qaPublicOrigin} from '@/lib/qa/publicOrigin';
import {createClientPortalToken} from '@/lib/quotes/clientPortalToken';

export const dynamic='force-dynamic';
export const metadata={title:'Isolated QA readiness | OPOS',robots:{index:false,follow:false}};

type Check={label:string;pass:boolean;detail:string};
export default async function QaReadiness({searchParams}:{searchParams:Promise<{quote?:string}>}){
  const {organisationId,profile}=await requireUserContext('/opos-next');
  assertRole(profile.role,['owner','admin']);
  if(!isKnownIsolatedQaBackend())notFound();
  const {quote:quoteId=''}=await searchParams;
  if(!/^[0-9a-f-]{36}$/i.test(quoteId))notFound();
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('Isolated QA database access is not configured.');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:quote,error:quoteError}=await db.from('quotes').select('id,lead_id,quote_number,revision,total,currency,status')
    .eq('id',quoteId).eq('organisation_id',organisationId).maybeSingle();
  if(quoteError||!quote)notFound();
  const [issue,contract,lead,signatory,authorisation,outbox,payment,release,project]=await Promise.all([
    db.from('quote_issue_records').select('client_response,recipient_email,quote_revision').eq('organisation_id',organisationId).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle(),
    db.from('quote_release_contracts').select('release_basis,opening_amount').eq('organisation_id',organisationId).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle(),
    db.from('leads').select('company_name').eq('organisation_id',organisationId).eq('id',quote.lead_id).maybeSingle(),
    db.from('quote_client_signatory_attestations').select('quote_id').eq('organisation_id',organisationId).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle(),
    db.from('op_sandbox_payment_authorisations').select('quote_id').eq('organisation_id',organisationId).eq('quote_id',quote.id).eq('quote_revision',quote.revision).gt('expires_at',new Date().toISOString()).maybeSingle(),
    db.from('notification_outbox').select('id,status,attempts,last_error,provider_message_id,created_at').eq('organisation_id',organisationId).eq('entity_type','quote').eq('entity_id',quote.id).like('subject','Secure client portal access%').order('created_at',{ascending:false}).limit(1).maybeSingle(),
    db.from('quote_payment_confirmations').select('confirmed_at').eq('organisation_id',organisationId).eq('quote_id',quote.id).maybeSingle(),
    db.from('quote_release_confirmations').select('confirmed_at').eq('organisation_id',organisationId).eq('quote_id',quote.id).maybeSingle(),
    db.from('projects').select('id').eq('organisation_id',organisationId).eq('quote_id',quote.id).maybeSingle(),
  ]);
  let origin='';let originOkay=false;
  try{origin=qaPublicOrigin();originOkay=true;}catch{/* Leave unavailable on fail-closed diagnostics. */}
  const stripeTestKey=Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'));
  const stripeWebhookSecret=Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'));
  const contractOkay=!contract.error&&['payment','deposit'].includes(String(contract.data?.release_basis))&&Number(contract.data?.opening_amount)>0;
  const accepted=!issue.error&&issue.data?.client_response==='accepted'&&Number(issue.data.quote_revision)===Number(quote.revision);
  const noPayment=!payment.error&&!release.error&&!project.error&&!payment.data?.confirmed_at&&!release.data?.confirmed_at&&!project.data?.id;
  const emailResult=outbox.data;
  const emailAccepted=!outbox.error&&emailResult?.status==='sent'&&Boolean(emailResult.provider_message_id);
  const checks:Check[]=[
    {label:'Isolated QA database',pass:true,detail:'Separate preview-only Supabase backend verified'},
    {label:'Stable QA URL',pass:originOkay,detail:originOkay?origin:'Missing or mismatched preview branch address'},
    {label:'Accepted controlled quotation',pass:accepted,detail:accepted?'Accepted revision '+quote.revision:'Accepted revision evidence missing'},
    {label:'Opening payment terms',pass:contractOkay,detail:contractOkay?String(contract.data?.release_basis)+' · '+String(contract.data?.opening_amount)+' '+quote.currency:'Frozen deposit/payment terms not available'},
    {label:'Named acceptance evidence',pass:!signatory.error&&Boolean(signatory.data),detail:signatory.data?'Present':'Missing or unavailable'},
    {label:'QA email configuration',pass:process.env.OP_QA_EMAIL_SENDING_ENABLED==='true'&&Boolean(process.env.RESEND_API_KEY)&&Boolean(process.env.RESEND_FROM_EMAIL),detail:'Isolated QA recipient allowlist still enforced'},
    {label:'Portal email accepted by provider',pass:emailAccepted,detail:outbox.error?'Outbox query failed':emailResult?emailResult.status+' · '+emailResult.attempts+' attempt(s)'+(emailResult.last_error?' · '+emailResult.last_error:''):'No portal delivery recorded'},
    {label:'Stripe test secret key',pass:stripeTestKey,detail:stripeTestKey?'Test-mode key present':'Missing or not test-mode (value hidden)'},
    {label:'Stripe deposit test switch',pass:process.env.OP_STRIPE_DEPOSIT_TEST_ENABLED==='true',detail:'Only required for staged opening payments'},
    {label:'Stripe test webhook signing secret',pass:stripeWebhookSecret,detail:stripeWebhookSecret?'Test webhook secret configured':'Missing (requires Stripe test endpoint, whsec_ key)'},
    {label:'Explicit sandbox case label',pass:!lead.error&&String(lead.data?.company_name||'').startsWith('OP QA TEST'),detail:'Checkout is only allowed for OP QA TEST-labelled cases'},
    {label:'Quote-specific sandbox authorisation',pass:!authorisation.error&&Boolean(authorisation.data),detail:authorisation.data?'Active QA authorisation found':'No active, explicitly approved authorisation'},
    {label:'Financial safety gate',pass:noPayment,detail:noPayment?'No verified payment or released project; Checkout cannot double-charge':'Financial state must be reconciled before further payment'},
  ];
  const paymentReady=checks.filter(x=>!['Portal email accepted by provider','Financial safety gate'].includes(x.label)).every(x=>x.pass)&&noPayment;
  // Only an explicitly allowlisted, fictional OP QA TEST case can expose this
  // operator-only access path. The client portal and Checkout still independently
  // enforce their own controlled acceptance and financial gates.
  const syntheticQaCase=String(lead.data?.company_name||'').startsWith('OP QA TEST') &&
    Boolean(authorisation.data) && !authorisation.error;
  const portalUrl=paymentReady&&syntheticQaCase
    ? '/client-portal?token='+encodeURIComponent(createClientPortalToken(quote.id,Number(quote.revision)))
    : null;
  return <div style={{maxWidth:920,margin:'0 auto',padding:'24px 12px',display:'grid',gap:20}}>
    <Link href={'/opos-next/cases/'+quote.lead_id} style={{color:'inherit'}}>← Back to Case 360</Link>
    <div><p style={{fontSize:12,letterSpacing:2,opacity:.65}}>ISOLATED QA · READ-ONLY PREFLIGHT</p>
      <h1 style={{fontSize:28,fontWeight:650}}>Payment and portal readiness</h1>
      <p style={{opacity:.75}}>Quotation {quote.quote_number} · No funds, authorisations, or case records are changed by this page.</p>
    </div>
    <div style={{padding:16,border:'1px solid currentColor',borderRadius:12}}>
      <strong>{paymentReady?'Checkout preflight passed':'Checkout preflight blocked'}</strong>
      <p style={{marginTop:8,opacity:.8}}>This is a configuration and database preflight, not proof of delivered email, real Stripe Checkout, or a reconciled webhook.</p>
      {portalUrl?<div style={{marginTop:14,display:'grid',gap:8}}>
        <Link href={portalUrl} style={{display:'inline-block',padding:'12px 18px',borderRadius:8,background:'#f2f2f2',color:'#171717',fontWeight:600,width:'fit-content'}}>
          Open fictional client portal · Stripe Sandbox →
        </Link>
        <p style={{fontSize:13,opacity:.75}}>This is a fictional £{Number(contract.data?.opening_amount).toFixed(2)} deposit. Use only Stripe's sandbox test payment method; no real card details.</p>
      </div>:null}
    </div>
    <div style={{display:'grid',gap:10}}>
      {checks.map(check=><div key={check.label} style={{border:'1px solid #7775',padding:14,borderRadius:10,display:'grid',gridTemplateColumns:'auto 1fr',gap:14,alignItems:'start'}}>
        <span aria-label={check.pass?'Passed':'Blocked'} style={{color:check.pass?'#3d9b6c':'#c98733',fontWeight:700}}>{check.pass?'✓':'!'}</span>
        <div><strong>{check.label}</strong><p style={{marginTop:4,opacity:.74,fontSize:14,overflowWrap:'anywhere'}}>{check.detail}</p></div>
      </div>)}
    </div>
    <p style={{fontSize:13,opacity:.7}}>Provider acceptance does not prove inbox delivery. Stripe configuration checks do not prove successful reconciliation. Browser and payment tests require separate evidence.</p>
  </div>;
}
