-- Isolated local Supabase DB only. No live credentials, customer data or charge.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select ok(to_regclass('public.quote_release_contracts') is not null,'Quote release contracts exist');
select ok(to_regclass('public.quote_client_signatory_attestations') is not null,'Named client signer attestations exist');
select ok(to_regclass('public.op_project_final_settlements') is not null,'Final settlement ledger exists');
select ok(to_regclass('public.op_project_final_release_approvals') is not null,'Manual owner final release ledger exists');
select ok(to_regclass('public.op_client_correction_entitlements') is not null,'Atomic single correction entitlement exists');
select ok(to_regclass('public.op_ew_bank_holidays') is not null,'England and Wales bank holiday calendar exists');
select ok(to_regclass('public.project_execution_assignments') is not null,'Partner execution assignment table exists');

select ok(to_regprocedure('public.op_finalize_verified_stripe_quote_payment(text)') is not null,'Opening verified Stripe project finalizer exists');
select ok(to_regprocedure('public.op_record_verified_project_final_settlement(uuid,text)') is not null,'Final Stripe reconciliation exists');
select ok(to_regprocedure('public.op_approve_project_final_release(uuid,uuid,uuid,text)') is not null,'Owner-only file release function exists');
select ok(to_regprocedure('public.op_record_classified_client_review(uuid,uuid,uuid,text,text,text,text,text,boolean)') is not null,'Classified correction RPC exists');

select ok((select relrowsecurity from pg_class where oid='public.quote_release_contracts'::regclass),'Quote contract rows protected by RLS');
select ok(to_regclass('public.quote_payment_provider_events') is null or (select relrowsecurity from pg_class where oid=to_regclass('public.quote_payment_provider_events')),'Legacy payment event table is absent or protected by RLS');
select ok(not has_table_privilege('anon','public.op_project_final_settlements','SELECT'),'Anonymous role cannot read final settlement evidence');
select ok(not has_table_privilege('authenticated','public.op_project_final_release_approvals','INSERT'),'App clients cannot directly create owner approvals');
select ok(
  (public.op_client_review_due_at('2026-12-24 12:00:00+00'::timestamptz,1) at time zone 'Europe/London')::date = '2026-12-29'::date,
  'Christmas and substitute bank holiday excluded from review deadline');
select ok(
  exists(select 1 from pg_indexes where schemaname='public'
    and indexname='ux_op_one_live_partner_execution_session'),
  'Only one active partner work-order session permitted');

select * from finish();
rollback;
