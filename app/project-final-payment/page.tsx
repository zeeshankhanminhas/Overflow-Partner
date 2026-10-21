import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';
import { createFinalStripeCheckout } from './stripe-action';

export const dynamic='force-dynamic';
export const metadata={title:'Final settlement | Overflow Partner',robots:{index:false,follow:false}};

export default async function FinalPaymentPage({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const {token=''}=await searchParams;
  const access=token?verifyClientPortalToken(token):null;
  if(!access)return <main><h1>Secure link unavailable</h1><p>Contact Overflow Partner for a fresh client portal link.</p></main>;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return <main><h1>Payment details unavailable</h1></main>;
  const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue}=await db.from('quote_issue_records').select('organisation_id,client_response')
    .eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if(issue?.client_response!=='accepted')return <main><h1>Accepted quotation required</h1></main>;
  const {data:quote}=await db.from('quotes').select('id,revision,total,currency,quote_number')
    .eq('id',access.quoteId).eq('organisation_id',issue.organisation_id).eq('revision',access.revision).maybeSingle();
  if(!quote)return <main><h1>Quotation unavailable</h1></main>;
  const {data:contract}=await db.from('quote_release_contracts').select('opening_amount,release_basis')
    .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
  const {data:project}=await db.from('projects').select('id,project_stage,project_number')
    .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  if(!project||!contract||!['deposit','payment'].includes(String(contract.release_basis)))
    return <main><h1>Final settlement terms unavailable</h1><p>Contact Overflow Partner.</p></main>;
  const {data:review}=await db.from('project_client_reviews').select('outcome')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id)
    .order('recorded_at',{ascending:false}).limit(1).maybeSingle();
  if(!review||!['accepted','accepted_with_comments'].includes(String(review.outcome)))
    return <main><h1>Awaiting your final review</h1><p>Final payment is requested only after your engineering review has been accepted.</p></main>;
  const {data:settlement}=await db.from('op_project_final_settlements').select('verified_at')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id).maybeSingle();
  const {data:release}=await db.from('op_project_final_release_approvals').select('approved_at')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id).maybeSingle();
  const remaining=Math.round((Number(quote.total)-Number(contract.opening_amount))*100)/100;
  const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:String(quote.currency||'GBP')}).format(n);
  const testCheckout=process.env.VERCEL_ENV==='preview'&&process.env.OP_ISOLATED_QA_BACKEND==='true'&&
    process.env.OP_STRIPE_FINAL_TEST_ENABLED==='true'&&process.env.OP_PACKAGE01_PAYMENTS_ENABLED==='true'&&
    Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'));
  return <main style={{maxWidth:660,margin:'3rem auto',padding:24}}>
    <p>OVERFLOW PARTNER · SECURE CLIENT PORTAL</p>
    <h1>Final engineering settlement</h1>
    <p>Project {project.project_number} · Quotation {quote.quote_number}</p>
    <p>Opening payment: {money(Number(contract.opening_amount))}</p>
    <h2>Final balance: {money(remaining)}</h2>
    {settlement ? <p>Final payment verified. {release?'The engineering package has been approved for release.':'Overflow Partner will complete the final manual handover approval.'}</p> :
      remaining>0 ? <><p>The final balance is due after your review and before the editable engineering package is released. Payment alone never automatically releases the files.</p>
        {testCheckout?<form action={createFinalStripeCheckout}><input type="hidden" name="token" value={token}/><button>Pay final balance securely with Stripe (test mode)</button></form>:
          <p>Online final settlement is not enabled for this account yet. Please contact Overflow Partner to arrange a verified bank transfer.</p>}</> :
      <p>No final payment is due under this accepted quotation.</p>}
  </main>;
}
