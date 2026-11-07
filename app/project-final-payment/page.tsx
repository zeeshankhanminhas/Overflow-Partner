import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { stripeRuntimeMode } from '@/lib/payments/stripeEnvironment';
import { createFinalStripeCheckout } from './stripe-action';
import css from '@/app/client-portal/clientPortal.module.css';

export const dynamic='force-dynamic';
export const metadata={title:'Final settlement | Overflow Partner',robots:{index:false,follow:false}};

function unavailable(title:string,detail='Contact Overflow Partner for assistance.'){
 return <main className={css.page}><div className={css.shell}><p className={css.brand}><span>◈</span> OVERFLOW PARTNER</p><section className={css.panel}>
   <p className={css.eyebrow}>SECURE CLIENT PORTAL</p><h1 className={css.title}>{title}</h1><p className={css.intro}>{detail}</p>
 </section></div></main>;
}
export default async function FinalPaymentPage({searchParams}:{searchParams:Promise<{token?:string;stripe_return?:string}>}) {
  const {token='',stripe_return=''}=await searchParams;
  // A Stripe return is a navigation hint, never evidence that payment cleared.
  const access=token?verifyClientPortalToken(token):null;
  if(!access)return unavailable('Secure link unavailable','Contact Overflow Partner for a fresh client portal link.');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return unavailable('Payment details unavailable');
  const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue}=await db.from('quote_issue_records').select('organisation_id,client_response')
    .eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if(issue?.client_response!=='accepted')return unavailable('Accepted quotation required');
  const {data:quote}=await db.from('quotes').select('id,revision,total,currency,quote_number')
    .eq('id',access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if(!quote)return unavailable('Quotation unavailable');
  const {data:contract}=await db.from('quote_release_contracts').select('opening_amount,release_basis')
    .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
  const {data:project}=await db.from('projects').select('id,project_stage,project_number')
    .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  if(!project||!contract||!['deposit','payment'].includes(String(contract.release_basis)))
    return unavailable('Final settlement terms unavailable');
  const {data:review}=await db.from('project_client_reviews').select('outcome')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id)
    .order('recorded_at',{ascending:false}).limit(1).maybeSingle();
  if(!review||!['accepted','accepted_with_comments'].includes(String(review.outcome)))
    return unavailable('Awaiting your final review','Final payment is requested only after your engineering review has been accepted.');
  const {data:invoice}=await db.from('invoices').select('id,invoice_number,status,total,amount_paid,currency')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id)
    .eq('quote_id',quote.id).eq('invoice_type','final').neq('status','cancelled').maybeSingle();
  const {data:settlement}=await db.from('op_project_final_settlements').select('verified_at')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id).maybeSingle();
  const {data:release}=await db.from('op_project_final_release_approvals').select('approved_at')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id).maybeSingle();
  const finalPaid=Boolean(settlement?.verified_at);
  const finalReleased=Boolean(release?.approved_at);
  const remaining=Math.round((Number(quote.total)-Number(contract.opening_amount))*100)/100;
  const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:String(quote.currency||'GBP')}).format(n);
  const paymentMode=stripeRuntimeMode();
  const invoiceMatches=Boolean(invoice&&['issued','paid'].includes(invoice.status)&&
    Number(invoice.total)===remaining&&String(invoice.currency).trim().toUpperCase()===String(quote.currency).trim().toUpperCase());
  const checkoutAvailable=invoiceMatches&&(paymentMode==='live' ||
    (paymentMode==='qa' && process.env.OP_STRIPE_FINAL_TEST_ENABLED==='true' &&
     Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))));
  return <main className={css.page}><div className={css.shell}>
    <p className={css.brand}><span>◈</span> OVERFLOW PARTNER</p>
    <p className={css.eyebrow}>SECURE CLIENT PORTAL / FINAL SETTLEMENT</p>
    <h1 className={css.title}>Final engineering settlement</h1>
    <p className={css.intro}>Project {project.project_number} · Quotation {quote.quote_number}</p>
    <section className={css.panel}>
      <div className={css.status}><p className={css.eyebrow}>FINAL BALANCE</p><h2>{money(remaining)}</h2><p>Opening payment: {money(Number(contract.opening_amount))}</p><p>Final invoice: {invoiceMatches?invoice?.invoice_number+' · '+invoice?.status:'Awaiting an issued final invoice from Overflow Partner'}</p></div>
      {finalPaid?<div className={css.section}><h3>Final payment verified</h3><p className={css.note}>{finalReleased?'The engineering package has been approved for controlled release.':'Overflow Partner must complete the separate final handover approval.'}</p></div>
        :remaining>0?<div className={css.section}><h3>Complete final settlement</h3><p className={css.note}>The final balance is due after client review acceptance and before native engineering files can be released. Payment alone never authorises final handover.</p>
          {stripe_return==='success'?<p className={css.note} role="status">Your Stripe Checkout has returned. Payment verification is pending until Overflow Partner receives independently verified Stripe webhook evidence. Please do not pay again or assume the final engineering files are released.</p>:
          !invoiceMatches?<p className={css.note}>Your final invoice must first be issued and matched to the agreed quotation. No payment is requested yet.</p>:
          checkoutAvailable?<form action={createFinalStripeCheckout}><input type="hidden" name="token" value={token}/><button type="submit" className={css.action+' '+css.primary}>Pay final balance securely →</button></form>
            :<p className={css.note}>Online final settlement is not enabled for this account. Contact Overflow Partner to arrange independently verified payment.</p>}
        </div>:<p className={css.note}>No final payment is due under this accepted quotation.</p>}
    </section>
    <p className={css.footer}>Final native engineering files require verified settlement and separate owner release approval.</p>
  </div></main>;
}
