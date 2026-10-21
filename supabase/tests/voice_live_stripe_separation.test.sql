-- Distinct live/test Stripe settlement authority must fail closed.
-- No Stripe calls, no emails, no remote Supabase. All state rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(to_regprocedure('public.op_finalize_live_stripe_quote_payment(text)') is not null,
  'Live opening-payment RPC is present after staged migration');
select ok(to_regprocedure('public.op_record_live_stripe_final_settlement(uuid,text)') is not null,
  'Live final settlement RPC exists');
select ok(not has_function_privilege('anon','public.op_finalize_live_stripe_quote_payment(text)','EXECUTE'),
  'Anonymous caller cannot reconcile live opening payments');
select ok(not has_function_privilege('authenticated','public.op_record_live_stripe_final_settlement(uuid,text)','EXECUTE'),
  'Authenticated frontend cannot reconcile live final payment');
select ok(exists(select 1 from information_schema.columns where table_schema='public'
  and table_name='quote_stripe_payment_events' and column_name='livemode' and is_nullable='NO'),
  'Stripe event ledger permanently records live or test mode');

select throws_ok(
  $sql$select public.op_finalize_live_stripe_quote_payment('cs_live_unverified_qa')$sql$,
  'Only the trusted payment service can reconcile live funds.',
  'Ordinary database actor cannot impersonate signed production Stripe webhook');

select set_config('request.jwt.claim.role','service_role',true);
select throws_ok(
  $sql$select public.op_finalize_live_stripe_quote_payment('cs_test_qa_staged')$sql$,
  'Live Stripe Checkout session required.',
  'Live finalizer cannot consume test Checkout IDs');
select throws_ok(
  $sql$select public.op_record_live_stripe_final_settlement('10000000-0000-4000-8000-000000000001'::uuid,'cs_test_qa_staged')$sql$,
  'Live Stripe Checkout session required.',
  'Live final settlement cannot use test Checkout evidence');

select * from finish();
rollback;
