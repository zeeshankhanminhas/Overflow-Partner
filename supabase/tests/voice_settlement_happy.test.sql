-- Isolated database: simulated Stripe payment evidence, no real Stripe/network.
-- Positive 30% + 70% database settlement, mismatches and webhook replay idempotency.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Seed a valid synthetic chain only. Suppress project and finance user triggers
-- during fixture creation, then turn them back on before all tested RPCs.
alter table public.projects disable trigger user;
alter table public.quote_payment_confirmations disable trigger user;
alter table public.project_client_reviews disable trigger user;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000009911','qa-paid-actor@example.invalid');
insert into public.organisations(id,name)
values ('00000000-0000-4000-8000-000000009912','OP QA TRANSACTION PAYMENT');
insert into public.profiles(id,organisation_id,role,full_name)
values ('00000000-0000-4000-8000-000000009911','00000000-0000-4000-8000-000000009912','owner','QA Owner')
on conflict(id) do update set organisation_id=excluded.organisation_id,role='owner';
insert into public.leads(id,organisation_id,created_by,company_name)
values ('00000000-0000-4000-8000-000000009913','00000000-0000-4000-8000-000000009912','00000000-0000-4000-8000-000000009911','OP QA TEST Payment');
insert into public.quotes(id,organisation_id,lead_id,quote_number,revision,total,subtotal,vat,currency,created_by)
values ('00000000-0000-4000-8000-000000009914','00000000-0000-4000-8000-000000009912','00000000-0000-4000-8000-000000009913','OP-QA-PAY-1',1,1000,1000,0,'GBP','00000000-0000-4000-8000-000000009911');
insert into public.quote_release_contracts(
 quote_id,organisation_id,quote_revision,release_basis,opening_amount,currency,
 authorised_contact_name,authorised_contact_email,approved_by)
values ('00000000-0000-4000-8000-000000009914','00000000-0000-4000-8000-000000009912',1,
 'deposit',300,'GBP','QA Signatory','signatory@example.invalid','00000000-0000-4000-8000-000000009911');
insert into public.projects(
 id,organisation_id,lead_id,quote_id,created_by,project_number,title,project_stage)
values ('00000000-0000-4000-8000-000000009915','00000000-0000-4000-8000-000000009912',
 '00000000-0000-4000-8000-000000009913','00000000-0000-4000-8000-000000009914',
 '00000000-0000-4000-8000-000000009911','OP-QA-PROJECT-PAY-1','Isolated completed engineering job','completion');
insert into public.quote_stripe_payment_events(
 stripe_event_id,stripe_session_id,quote_id,organisation_id,quote_revision,amount_total,currency,stripe_payment_status)
values
 ('evt_qa_opening','cs_qa_opening','00000000-0000-4000-8000-000000009914','00000000-0000-4000-8000-000000009912',1,30000,'GBP','paid'),
 ('evt_qa_final','cs_qa_final','00000000-0000-4000-8000-000000009914','00000000-0000-4000-8000-000000009912',1,69900,'GBP','paid'),
 ('evt_qa_second','cs_qa_second','00000000-0000-4000-8000-000000009914','00000000-0000-4000-8000-000000009912',1,70000,'GBP','paid');
insert into public.quote_payment_confirmations(
 organisation_id,quote_id,lead_id,amount,currency,payment_method,payment_reference,confirmed_at,recorded_by)
values ('00000000-0000-4000-8000-000000009912','00000000-0000-4000-8000-000000009914',
 '00000000-0000-4000-8000-000000009913',300,'GBP','stripe','cs_qa_opening',now(),
 '00000000-0000-4000-8000-000000009911');
insert into public.project_client_reviews(
 organisation_id,project_id,outcome,evidence_basis,evidence_reference,recorded_by)
values ('00000000-0000-4000-8000-000000009912','00000000-0000-4000-8000-000000009915',
 'accepted','client_portal','QA-ACCEPTANCE-1','00000000-0000-4000-8000-000000009911');
alter table public.projects enable trigger user;
alter table public.quote_payment_confirmations enable trigger user;
alter table public.project_client_reviews enable trigger user;

select set_config('request.jwt.claim.role','service_role',true);

select throws_ok(
 $$select public.op_record_verified_project_final_settlement(
  '00000000-0000-4000-8000-000000009915','cs_qa_final')$$,
 'Final settlement amount or currency mismatch.',
 '£699 final payment cannot be reconciled against a £700 balance');

select is(
 (select count(*)::integer from public.op_project_final_settlements where
 project_id='00000000-0000-4000-8000-000000009915'),0,
 'Mismatched payment cannot create a settlement');

update public.quote_stripe_payment_events set amount_total=70000 where stripe_session_id='cs_qa_final';

select is(
 (public.op_record_verified_project_final_settlement(
 '00000000-0000-4000-8000-000000009915','cs_qa_final')).amount,
 700::numeric,'A verified £700 final payment reconciles after a £300 opening receipt');

select is(
 (select quote_revision from public.op_project_final_settlements where project_id='00000000-0000-4000-8000-000000009915'),
 1,'Reconciled final settlement is bound to quotation revision 1');

select lives_ok(
 $$select public.op_record_verified_project_final_settlement(
  '00000000-0000-4000-8000-000000009915','cs_qa_final')$$,
 'Replayed Stripe webhook is idempotent');

select is(
 (select count(*)::integer from public.op_project_final_settlements where project_id='00000000-0000-4000-8000-000000009915'),
 1,'Replayed event produces exactly one final settlement record');

select throws_ok(
 $$select public.op_record_verified_project_final_settlement(
  '00000000-0000-4000-8000-000000009915','cs_qa_second')$$,
 'Final payment already recorded with different evidence.',
 'A second paid session cannot replace already recorded final evidence');

select is(
 (select stripe_session_id from public.op_project_final_settlements where project_id='00000000-0000-4000-8000-000000009915'),
 'cs_qa_final','Original paid session remains immutable after a competing replay');
select * from finish();
rollback;
