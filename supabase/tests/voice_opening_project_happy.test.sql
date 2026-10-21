-- Fully synthetic positive opening Stripe receipt -> one governed Project 360.
-- Never connects to remote Supabase, Stripe or customer email. Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Controlled, synthetic acceptance fixture. Privileged quote/document triggers
-- bypassed only for creating already-approved fixtures, never for finalizer call.
alter table public.quotes disable trigger user;
alter table public.documents disable trigger user;
alter table public.quote_issue_records disable trigger user;

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000009921','qa-acceptance-actor@example.invalid');
insert into public.organisations(id,name)
values ('00000000-0000-4000-8000-000000009922','OP QA TEST Opening Project Creation');
insert into public.profiles(id,organisation_id,role,full_name)
values ('00000000-0000-4000-8000-000000009921','00000000-0000-4000-8000-000000009922','owner','Test Owner')
on conflict(id) do update set role='owner',organisation_id=excluded.organisation_id;
insert into public.leads(id,organisation_id,created_by,company_name,status)
values ('00000000-0000-4000-8000-000000009923','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009921','OP QA TEST · opening payment','qualified');
insert into public.quotes(
 id,organisation_id,lead_id,quote_number,revision,total,subtotal,vat,currency,created_by,status,valid_until)
values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009923','OP-QA-OPEN-1',1,1000,1000,0,'GBP',
 '00000000-0000-4000-8000-000000009921','issued',current_date+14);
insert into public.documents(
 organisation_id,quote_id,created_by,document_type,reference,title,status,version,is_current_revision)
values ('00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009921',
 'client-quote','OP-QA-CONTROLLED-1','Controlled quote QA','issued',1,true);
insert into public.quote_release_contracts(
 quote_id,organisation_id,quote_revision,release_basis,opening_amount,currency,
 authorised_contact_name,authorised_contact_email,approved_by)
values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
 1,'deposit',300,'GBP','Named QA Client','qa-client@example.invalid',
 '00000000-0000-4000-8000-000000009921');
insert into public.quote_client_signatory_attestations(
 quote_id,organisation_id,quote_revision,signatory_name,signatory_email)
values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
 1,'Named QA Client','qa-client@example.invalid');
insert into public.quote_issue_records(
 organisation_id,quote_id,lead_id,quote_revision,recipient_name,recipient_email,
 delivery_method,evidence_reference,recorded_by,client_response,client_response_at)
values ('00000000-0000-4000-8000-000000009922','00000000-0000-4000-8000-000000009924',
 '00000000-0000-4000-8000-000000009923',1,'Named QA Client','qa-client@example.invalid',
 'client_portal','OP-QA-QUOTE-ISSUED','00000000-0000-4000-8000-000000009921',
 'accepted',now());
insert into public.op_sandbox_payment_authorisations(
 quote_id,organisation_id,quote_revision,expires_at,note)
values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
 1,now()+interval '1 day','synthetic approved QA customer only');
insert into public.quote_stripe_payment_events(
 stripe_event_id,stripe_session_id,quote_id,organisation_id,quote_revision,amount_total,
 currency,stripe_payment_status)
values ('evt_qa_project_opening','cs_qa_project_opening',
 '00000000-0000-4000-8000-000000009924',
 '00000000-0000-4000-8000-000000009922',1,30000,'GBP','paid');

insert into public.quote_stripe_payment_events(
 stripe_event_id,stripe_session_id,quote_id,organisation_id,quote_revision,amount_total,
 currency,stripe_payment_status)
values ('evt_qa_project_wrong_amount','cs_qa_project_wrong_amount',
 '00000000-0000-4000-8000-000000009924',
 '00000000-0000-4000-8000-000000009922',1,29900,'GBP','paid');
alter table public.quotes enable trigger user;
alter table public.documents enable trigger user;
alter table public.quote_issue_records enable trigger user;

select set_config('request.jwt.claim.role','service_role',true);
select throws_ok(
 $sql$select public.op_finalize_verified_stripe_quote_payment('cs_qa_project_wrong_amount')$sql$,
 'Stripe payment evidence must exactly equal the frozen opening payment.',
 '£299 test charge cannot create a project against a £300 frozen deposit');

select is(
 (select count(*)::integer from public.projects
  where quote_id='00000000-0000-4000-8000-000000009924'),0,
 'Wrong opening charge creates no project');

select lives_ok(
 $sql$select public.op_finalize_verified_stripe_quote_payment('cs_qa_project_opening')$sql$,
 'Paid 30% with approved signatory and current issued PDF creates governed Project 360');

select is(
 (select count(*)::integer from public.projects
    where organisation_id='00000000-0000-4000-8000-000000009922'
      and quote_id='00000000-0000-4000-8000-000000009924'),
 1,'Exactly one Project 360 created from opening settlement');

select is(
 (select amount from public.quote_payment_confirmations
  where quote_id='00000000-0000-4000-8000-000000009924'),300::numeric,
 'Opening payment record is £300, never the full £1,000');

select lives_ok(
 $sql$select public.op_finalize_verified_stripe_quote_payment('cs_qa_project_opening')$sql$,
 'Replayed signed opening payment is idempotent');

select is(
 (select count(*)::integer from public.projects
    where quote_id='00000000-0000-4000-8000-000000009924'),1,
 'Repeated webhook does not duplicate Project 360');

select is(
 (select count(*)::integer from public.quote_payment_confirmations
    where quote_id='00000000-0000-4000-8000-000000009924'),1,
 'Repeated webhook does not duplicate opening receipt');
select * from finish();
rollback;
