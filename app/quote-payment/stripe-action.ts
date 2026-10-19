'use server';

import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { verifyClientPortalToken } from '@/lib/quotes/clientPortalToken';

export async function createStripeCheckout(formData: FormData) {
  if (process.env.OP_PACKAGE01_PAYMENTS_ENABLED !== 'true') throw new Error('The new payment flow is not yet enabled.');
  if (process.env.VERCEL_ENV !== 'preview' || process.env.OP_PACKAGE01_SANDBOX_SHARED_DB_ALLOWED !== 'true') throw new Error('Shared-database sandbox requires explicit Preview-only approval.');
  const token = String(formData.get('token') || '');
  const access = verifyClientPortalToken(token);
  if (!access) throw new Error('Secure payment link has expired.');
  const apiKey = process.env.STRIPE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const dbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Test Checkout must return to the same Preview deployment, never the production hostname.
  const previewHost = process.env.VERCEL_URL;
  if (!previewHost || !/^[a-z0-9.-]+\.vercel\.app$/i.test(previewHost)) throw new Error('A verified Vercel Preview return host is required.');
  const site = `https://${previewHost}`;
  if (!apiKey || !url || !dbKey) throw new Error('Stripe payment is not configured.');
  if (!apiKey.startsWith('sk_test_')) throw new Error('Package 01 preview only permits Stripe test keys.');
  const db = createSupabaseClient(url, dbKey, {auth:{persistSession:false,autoRefreshToken:false}});
  const { data: issue, error: issueError } = await db.from('quote_issue_records').select('organisation_id,client_response').eq('quote_id',access.quoteId).eq('quote_revision',access.revision).maybeSingle();
  if (issueError || issue?.client_response !== 'accepted') throw new Error('Accepted quotation required.');
  const {data:quote,error:quoteError}=await db.from('quotes').select('id,lead_id,quote_number,revision,status,total,currency,valid_until').eq('organisation_id',issue.organisation_id).eq('id',access.quoteId).eq('revision',access.revision).maybeSingle();
  if (quoteError || !quote || !['issued','accepted'].includes(quote.status)) throw new Error('Current quotation unavailable.');
  const {data:qaLead,error:qaError}=await db.from('leads').select('company_name').eq('organisation_id',issue.organisation_id).eq('id',quote.lead_id).maybeSingle();
  if (qaError || !qaLead?.company_name?.startsWith('OP QA TEST')) throw new Error('Sandbox Checkout is restricted to explicitly labelled QA cases.');
  const {data:authorisation,error:authorisationError}=await db.from('op_sandbox_payment_authorisations')
    .select('quote_id').eq('quote_id',quote.id).eq('organisation_id',issue.organisation_id)
    .eq('quote_revision',quote.revision).gt('expires_at',new Date().toISOString()).maybeSingle();
  if (authorisationError || !authorisation) throw new Error('Quotation not explicitly authorised for Stripe Sandbox testing.');
  if (quote.valid_until && new Date(`${quote.valid_until}T23:59:59.999Z`).getTime() < Date.now()) throw new Error('Quotation expired.');
  const {data:paid,error:paidError}=await db.from('quote_payment_confirmations').select('id').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  const {data:released,error:releaseError}=await db.from('quote_release_confirmations').select('id').eq('organisation_id',issue.organisation_id).eq('quote_id',quote.id).maybeSingle();
  if (paidError || releaseError || paid || released) throw new Error('Payment is already recorded or the quote is released. Contact OP before attempting another payment.');
  const currency=String(quote.currency||'GBP').trim().toLowerCase();
  const pennies=Math.round(Number(quote.total)*100);
  if (currency !== 'gbp' || !Number.isSafeInteger(pennies) || pennies < 50) throw new Error('Unsupported quote amount or currency.');
  // Until deposit/credit terms are machine-readable, do not charge the full quote incorrectly.
  if (process.env.OP_STRIPE_FULL_PAYMENT_ONLY !== 'true') throw new Error('Payment terms must be approved for full-amount Stripe Checkout before this option is enabled.');
  const params = new URLSearchParams();
  params.set('mode','payment');
  params.set('payment_method_types[0]','card');
  params.set('line_items[0][price_data][currency]',currency);
  params.set('line_items[0][price_data][unit_amount]',String(pennies));
  params.set('line_items[0][price_data][product_data][name]',`Overflow Partner quotation ${quote.quote_number}`);
  params.set('line_items[0][quantity]','1');
  params.set('metadata[quote_id]',quote.id);
  params.set('metadata[quote_revision]',String(quote.revision));
  params.set('metadata[organisation_id]',issue.organisation_id);
  params.set('success_url',`${site}/quote-payment?token=${encodeURIComponent(token)}&stripe_return=success`);
  params.set('cancel_url',`${site}/quote-payment?token=${encodeURIComponent(token)}&stripe_return=cancelled`);
  const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':`op-test-quote-${quote.id}-r${quote.revision}`},body:params.toString(),cache:'no-store'});
  const session=await response.json();
  if (!response.ok || !session.url || !session.id) throw new Error('Stripe Checkout is temporarily unavailable.');
  // No payment is marked received here. A separately authenticated webhook must verify settlement.
  redirect(session.url);
}
