'use server';

import { assertIsolatedQaBackend } from '@/lib/qa/isolation';
import { stripeRuntimeMode, checkoutOrigin } from '@/lib/payments/stripeEnvironment';

import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';

/** QA-only final-balance Checkout. Never enable with the shared live Supabase project. */
export async function createFinalStripeCheckout(formData:FormData) {
  const mode=stripeRuntimeMode();
  if(!mode || (mode==='qa' && process.env.OP_STRIPE_FINAL_TEST_ENABLED!=='true'))
    throw new Error('Final-balance Stripe Checkout is not authorised.');
  if(mode==='qa')assertIsolatedQaBackend();
  const token=String(formData.get('token')||'');
  const access=verifyClientPortalToken(token);
  if(!access)throw new Error('Your secure client portal link is no longer valid.');
  const apiKey=process.env.STRIPE_SECRET_KEY;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site=checkoutOrigin(mode);
  if(!url||!key||!apiKey?.startsWith(mode==='live'?'sk_live_':'sk_test_'))
    throw new Error('Stripe credentials do not match the authorised payment environment.');
  const db=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:issue}=await db.from('quote_issue_records').select('organisation_id,client_response')
    .eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if(issue?.client_response!=='accepted')throw new Error('Signed quotation acceptance is required.');
  const {data:quote}=await db.from('quotes').select('id,revision,quote_number,total,currency,lead_id')
    .eq('organisation_id',issue.organisation_id).eq('id',access.quoteId).eq('revision',access.revision).maybeSingle();
  if(!quote)throw new Error('Current accepted quotation not found.');
  if(mode==='qa'){
    const {data:lead}=await db.from('leads').select('company_name').eq('organisation_id',issue.organisation_id)
      .eq('id',quote.lead_id).maybeSingle();
    if(!lead?.company_name?.startsWith('OP QA TEST'))throw new Error('Test Checkout requires a labelled QA customer.');
    const {data:authorisation}=await db.from('op_sandbox_payment_authorisations').select('quote_id')
      .eq('quote_id',quote.id).eq('organisation_id',issue.organisation_id).eq('quote_revision',quote.revision)
      .gt('expires_at',new Date().toISOString()).maybeSingle();
    if(!authorisation)throw new Error('QA quotation has not been approved for Stripe testing.');
  }
  const {data:contract}=await db.from('quote_release_contracts').select('opening_amount,currency,release_basis')
    .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).eq('quote_revision',quote.revision).maybeSingle();
  if(!contract || !['payment','deposit'].includes(String(contract.release_basis)))
    throw new Error('Frozen quotation settlement terms unavailable.');
  const remaining=Math.round((Number(quote.total)-Number(contract.opening_amount))*100);
  if(!Number.isSafeInteger(remaining)||remaining<50||String(quote.currency).toLowerCase()!=='gbp')
    throw new Error('No eligible final balance is due on this quotation.');
  const {data:project}=await db.from('projects').select('id,project_stage').eq('organisation_id',issue.organisation_id)
    .eq('quote_id',quote.id).maybeSingle();
  if(!project || !['client_review','completion'].includes(String(project.project_stage)))
    throw new Error('Project client review must be complete before requesting final payment.');
  const {data:review}=await db.from('project_client_reviews').select('outcome')
    .eq('organisation_id',issue.organisation_id).eq('project_id',project.id)
    .order('recorded_at',{ascending:false}).limit(1).maybeSingle();
  if(!review || !['accepted','accepted_with_comments'].includes(String(review.outcome)))
    throw new Error('Latest client review must be accepted.');
  const {data:opening}=await db.from('quote_payment_confirmations').select('amount,payment_method,payment_reference')
    .eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  if(!opening || opening.payment_method!=='stripe'||Number(opening.amount)<Number(contract.opening_amount))
    throw new Error('The opening payment has not been reconciled.');
  const {data:paid}=await db.from('op_project_final_settlements').select('project_id')
    .eq('project_id',project.id).maybeSingle();
  if(paid)throw new Error('Final payment is already confirmed. Do not pay twice.');
  const params=new URLSearchParams();
  params.set('mode','payment');
  params.set('payment_method_types[0]','card');
  params.set('line_items[0][price_data][currency]','gbp');
  params.set('line_items[0][price_data][unit_amount]',String(remaining));
  params.set('line_items[0][price_data][product_data][name]',`Overflow Partner final balance · ${quote.quote_number}`);
  params.set('line_items[0][quantity]','1');
  params.set('metadata[quote_id]',quote.id);
  params.set('metadata[quote_revision]',String(quote.revision));
  params.set('metadata[organisation_id]',issue.organisation_id);
  params.set('metadata[project_id]',project.id);
  params.set('metadata[payment_stage]','final');
  params.set('success_url',`${site}/project-final-payment?token=${encodeURIComponent(token)}&stripe_return=success`);
  params.set('cancel_url',`${site}/project-final-payment?token=${encodeURIComponent(token)}&stripe_return=cancelled`);
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/x-www-form-urlencoded',
      'Idempotency-Key':`op-${mode}-final-${project.id}-r${quote.revision}-${remaining}`},
    body:params.toString(),cache:'no-store'
  });
  const session=await response.json();
  if(!response.ok||!session.url||!session.id)throw new Error('Unable to start Stripe Sandbox final payment.');
  redirect(session.url);
}
