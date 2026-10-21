-- OPOS transaction-level rejection tests, isolated GitHub CI only.
-- All fixtures and attempted state transitions are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Seed private dummy organisation, actor, opportunity and project with triggers
-- disabled ONLY for fixture creation. All tested actions run with triggers ON.
select set_config('session_replication_role','replica',true);
insert into auth.users(id,email)
values ('00000000-0000-4000-8000-000000009901','qa-transaction-actor@example.invalid');
insert into public.organisations(id,name)
values ('00000000-0000-4000-8000-000000009902','OP QA TRANSACTION ISOLATED');
insert into public.profiles(id,organisation_id,role,full_name)
values ('00000000-0000-4000-8000-000000009901','00000000-0000-4000-8000-000000009902','owner','QA Owner');
insert into public.leads(id,organisation_id,created_by,company_name)
values ('00000000-0000-4000-8000-000000009903','00000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009901','OP QA TEST · isolated contract');
insert into public.projects(id,organisation_id,lead_id,created_by,project_number,title,project_stage)
values ('00000000-0000-4000-8000-000000009904','00000000-0000-4000-8000-000000009902','00000000-0000-4000-8000-000000009903','00000000-0000-4000-8000-000000009901','OP-QA-TRANS-01','Isolated payment gate negative tests','completion');
select set_config('session_replication_role','origin',true);

select throws_ok(
  $$ select public.op_record_verified_project_final_settlement('00000000-0000-4000-8000-000000009904'::uuid,'fake-paid-session') $$,
  'Only the payment-reconciliation service may confirm final settlement.',
  'An untrusted caller cannot record final payment');

select throws_ok(
  $$ select public.op_approve_project_final_release(
     '00000000-0000-4000-8000-000000009902'::uuid,
     '00000000-0000-4000-8000-000000009901'::uuid,
     '00000000-0000-4000-8000-000000009904'::uuid) $$,
  'Authenticated OPOS owner approval is required.',
  'An unauthenticated request cannot approve final engineering files');

select throws_ok(
  $$ select public.op_record_classified_client_review(
     '00000000-0000-4000-8000-000000009902'::uuid,
     '00000000-0000-4000-8000-000000009901'::uuid,
     '00000000-0000-4000-8000-000000009904'::uuid,
     'changes_requested','client_portal','client-evidence','Correction notes','in_scope_correction',false) $$,
  'Authenticated operator identity is required for client feedback classification.',
  'Client corrections cannot be recorded without workspace actor identity');

select throws_ok(
  $$ select public.op_get_client_review_window(
     '00000000-0000-4000-8000-000000009902'::uuid,
     '00000000-0000-4000-8000-000000009901'::uuid,
     '00000000-0000-4000-8000-000000009904'::uuid) $$,
  'Authenticated workspace actor required.',
  'Review window is not exposed to unauthenticated clients');

select throws_ok(
  $$ select public.op_project_voice_final_release_status(
     '00000000-0000-4000-8000-000000009902'::uuid,
     '00000000-0000-4000-8000-000000009901'::uuid,
     '00000000-0000-4000-8000-000000009904'::uuid) $$,
  'Authenticated workspace actor required.',
  'Project financial status requires workspace identity');

select throws_ok(
  $$ insert into public.partner_payments(
       organisation_id,project_id,payable_id,amount,reference)
     values ('00000000-0000-4000-8000-000000009902',
       '00000000-0000-4000-8000-000000009904',
       '00000000-0000-4000-8000-000000009905',100,NULL) $$,
  'Partner payment must have amount and actual payment reference.',
  'Partner payment cannot be recorded without a bank reference');

select throws_ok(
  $$ insert into public.partner_payments(
       organisation_id,project_id,payable_id,amount,reference)
     values ('00000000-0000-4000-8000-000000009902',
       '00000000-0000-4000-8000-000000009904',
       '00000000-0000-4000-8000-000000009905',100,'BANK-QA-FAKE-001') $$,
  'Partner payment blocked until client settles and final files are owner-released.',
  'A payment reference cannot bypass absent client settlement and release');

select throws_ok(
  $$ update public.projects set project_stage='closed'
     where id='00000000-0000-4000-8000-000000009904' $$,
  'Final files require explicit owner release before closure.',
  'No project closure before manual release');

select is((select project_stage from public.projects where id='00000000-0000-4000-8000-000000009904'),
  'completion','Rejected closure leaves project stage unchanged');

select ok(not has_function_privilege('anon',
  'public.op_record_verified_project_final_settlement(uuid,text)','EXECUTE'),
  'Anonymous clients cannot invoke payment reconciliation RPC');
select ok(not has_function_privilege('authenticated',
  'public.op_record_verified_project_final_settlement(uuid,text)','EXECUTE'),
  'Authenticated customers cannot invoke payment reconciliation RPC');
select ok(not has_function_privilege('service_role',
  'public.op_approve_project_final_release(uuid,uuid,uuid,text)','EXECUTE'),
  'Service role cannot bypass human final-release approval');
select ok(not has_function_privilege('anon',
  'public.op_record_classified_client_review(uuid,uuid,uuid,text,text,text,text,text,boolean)','EXECUTE'),
  'Client cannot call operator classified-feedback RPC');

select throws_ok(
 $$ select public.op_client_review_due_at('2029-01-02'::timestamptz,7) $$,
 'England/Wales business calendar not configured for 2029',
 'Review SLA fails closed when official holiday calendar is not configured');
select throws_ok(
 $$ select public.op_client_review_due_at('2026-10-21'::timestamptz,0) $$,
 'Valid transmittal date and 1-60 working days required.',
 'Invalid zero-length review deadline rejected');
select is((public.op_client_review_due_at('2026-10-23 10:00:00+00'::timestamptz,7)
  at time zone 'Europe/London')::date,'2026-11-03'::date,
  'Seven working days spans two weekends correctly');

select * from finish();
rollback;
