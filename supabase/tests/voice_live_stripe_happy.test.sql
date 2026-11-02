-- Positive live-mode DB contract against synthetic, non-charge Stripe events.
-- Disposable Github local Supabase only. Every mutation is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

alter table public.quotes disable trigger user;
alter table public.documents disable trigger user;
alter table public.quote_issue_records disable trigger user;
alter table public.partner_review_requests disable trigger user;
alter table public.partner_quotes disable trigger user;
alter table public.commercial_reviews disable trigger user;

insert into auth.users(id,email)
values ('00000000-0000-4000-8000-000000009921','stripe-http-qa@example.invalid');
insert into public.organisations(id,name)
values ('00000000-0000-4000-8000-000000009922','OP QA TEST · Stripe HTTP disposable');
insert into public.profiles(id,organisation_id,role,full_name)
values ('00000000-0000-4000-8000-000000009921','00000000-0000-4000-8000-000000009922','owner','QA Owner')
on conflict(id) do update set role='owner',organisation_id=excluded.organisation_id;
insert into public.leads(id,organisation_id,created_by,company_name,status)
values ('00000000-0000-4000-8000-000000009923','00000000-0000-4000-8000-000000009922',
'00000000-0000-4000-8000-000000009921','OP QA TEST · Stripe HTTP opening','qualified');
-- This is a DISPOSABLE LOCAL DATABASE ONLY. QA test names and assertions are
-- entirely fictional. These entries cannot be used as real NDA signatures,
-- supplier capability approvals, or commercial authorisations.
-- The fixture must never be loaded into hosted QA, staging or production.
insert into public.partners(
 id,organisation_id,company_name,country,services,contact_name,email,nda_signed,nda_signed_at,status
) values (
 '00000000-0000-4000-8000-000000009925','00000000-0000-4000-8000-000000009922',
 'LOCAL HTTP TEST PARTNER / NOT A REAL LEGAL ENTITY','UK','fictional CAD engineering test','CI Simulation',
 'ci-partner@example.invalid',true,now()-interval '4 days','approved'
);
insert into public.op_partner_nda_verifications(
 id,organisation_id,partner_id,evidence_reference,signed_by_name,signed_at,verified_by,verified_at
) values (
 '00000000-0000-4000-8000-000000009926','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009925','CI-ONLY-NDA-FICTIONAL-NOT-EXECUTED',
 'CI FICTIONAL SIMULATION',now()-interval '4 days','00000000-0000-4000-8000-000000009921',
 now()-interval '3 days 22 hours'
);
insert into public.op_partner_internal_approvals(
 id,organisation_id,partner_id,nda_verification_id,capability_evidence_reference,decision_note,
 approved_by,approved_at
) values (
 '00000000-0000-4000-8000-000000009927','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009925','00000000-0000-4000-8000-000000009926',
 'CI-ONLY-FICTIONAL-CAPABILITY',
 'Ephemeral CI simulated technical approval. Not a supplier eligibility decision.',
 '00000000-0000-4000-8000-000000009921',now()-interval '3 days'
);
insert into public.technical_intakes(
 id,organisation_id,lead_id,created_by,description,status,reviewed_by,reviewed_at
) values (
 '00000000-0000-4000-8000-000000009928','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009923','00000000-0000-4000-8000-000000009921',
 'Ephemeral fabricated engineering bracket specification','approved',
 '00000000-0000-4000-8000-000000009921',now()-interval '2 days'
);
insert into public.partner_review_requests(
 id,organisation_id,lead_id,technical_intake_id,partner_id,token_hash,case_reference,
 status,response_due_at,expires_at,scope_summary,submitted_at,created_by
) values (
 '00000000-0000-4000-8000-000000009929','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009923','00000000-0000-4000-8000-000000009928',
 '00000000-0000-4000-8000-000000009925','CI-ONLY-DUMMY-NOT-A-TOKEN','CI-TEST-001',
 'approved',now()+interval '2 days',now()+interval '2 days',
 'Disposable mechanical bracket CAD',now()-interval '20 hours',
 '00000000-0000-4000-8000-000000009921'
);
insert into public.partner_review_responses(
 id,organisation_id,partner_review_request_id,feasibility,confidence_percent,
 capability_confirmed,capacity_status,pricing_readiness,declaration_checked,reviewer_name,estimated_engineering_hours,estimated_lead_time_days,submitted_at
) values (
 '00000000-0000-4000-8000-000000009930','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009929','feasible',100,true,'available',
 'ready',true,'CI Simulation',35,7,now()-interval '20 hours'
);
insert into public.partner_review_internal_decisions(
 organisation_id,partner_review_request_id,partner_review_response_id,decision,
 reviewed_by,approved_at
) values (
 '00000000-0000-4000-8000-000000009922','00000000-0000-4000-8000-000000009929',
 '00000000-0000-4000-8000-000000009930','approved',
 '00000000-0000-4000-8000-000000009921',now()-interval '19 hours'
);
insert into public.documents(
 organisation_id,lead_id,technical_intake_id,created_by,document_type,reference,title,
 status,version,is_current_revision,approved_at
) values (
 '00000000-0000-4000-8000-000000009922','00000000-0000-4000-8000-000000009923',
 '00000000-0000-4000-8000-000000009928','00000000-0000-4000-8000-000000009921',
 'client-requirements','CI-TEST-REQ-001','Disposable approved fictitious requirements',
 'approved',1,true,now()-interval '18 hours'
);
insert into public.partner_quotes(
 id,organisation_id,partner_id,lead_id,technical_intake_id,price,currency,
 status,submitted_at,partner_review_request_id,partner_review_response_id
) values (
 '00000000-0000-4000-8000-000000009931','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009925','00000000-0000-4000-8000-000000009923',
 '00000000-0000-4000-8000-000000009928',700,'GBP','received',
 now()-interval '18 hours','00000000-0000-4000-8000-000000009929',
 '00000000-0000-4000-8000-000000009930'
);
insert into public.commercial_reviews(
 id,organisation_id,lead_id,partner_quote_id,client_price,cost_price,status,
 created_by,approved_by,approved_at
) values (
 '00000000-0000-4000-8000-000000009932','00000000-0000-4000-8000-000000009922',
 '00000000-0000-4000-8000-000000009923','00000000-0000-4000-8000-000000009931',
 1000,700,'approved','00000000-0000-4000-8000-000000009921',
 '00000000-0000-4000-8000-000000009921',now()-interval '17 hours'
);
insert into public.quotes(
  id,organisation_id,lead_id,commercial_review_id,quote_number,revision,total,subtotal,vat,currency,created_by,status,issued_at,valid_until
) values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
'00000000-0000-4000-8000-000000009923','00000000-0000-4000-8000-000000009932','OP-QA-HTTP-1',1,1000,1000,0,'GBP',
'00000000-0000-4000-8000-000000009921','issued',now()-interval '16 hours',current_date+14);
insert into public.documents(
  organisation_id,quote_id,created_by,document_type,reference,title,status,version,is_current_revision
) values ('00000000-0000-4000-8000-000000009922','00000000-0000-4000-8000-000000009924',
'00000000-0000-4000-8000-000000009921','client-quote','OP-QA-HTTP-DOC-1',
'Disposable client quote','issued',1,true);
insert into public.quote_release_contracts(
  quote_id,organisation_id,quote_revision,release_basis,opening_amount,currency,
  authorised_contact_name,authorised_contact_email,approved_by
) values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
1,'deposit',300,'GBP','QA Client','qa-client@example.invalid',
'00000000-0000-4000-8000-000000009921');
insert into public.quote_client_signatory_attestations(
  quote_id,organisation_id,quote_revision,signatory_name,signatory_email
) values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
1,'QA Client','qa-client@example.invalid');
insert into public.quote_issue_records(
  organisation_id,quote_id,lead_id,quote_revision,recipient_name,recipient_email,
  delivery_method,evidence_reference,recorded_by,client_response,client_response_at
) values ('00000000-0000-4000-8000-000000009922','00000000-0000-4000-8000-000000009924',
'00000000-0000-4000-8000-000000009923',1,'QA Client','qa-client@example.invalid',
'client_portal','OP-QA-HTTP-QUOTE-ISSUED','00000000-0000-4000-8000-000000009921',
'accepted',now());
insert into public.op_sandbox_payment_authorisations(
 quote_id,organisation_id,quote_revision,expires_at,note
) values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
1,now()+interval '1 day','Disposable CI. No remote access and no external payments.');

alter table public.quotes enable trigger user;
alter table public.documents enable trigger user;
alter table public.partner_review_requests enable trigger user;
alter table public.partner_quotes enable trigger user;
alter table public.commercial_reviews enable trigger user;
alter table public.quote_issue_records enable trigger user;

-- Live finalizers must not require the QA allowlist or a QA-prefixed lead.
update public.leads set company_name='Launch Pilot Engineering Ltd'
 where id='00000000-0000-4000-8000-000000009923';
delete from public.op_sandbox_payment_authorisations
 where quote_id='00000000-0000-4000-8000-000000009924';

insert into public.quote_stripe_payment_events(
 stripe_event_id,stripe_session_id,quote_id,organisation_id,quote_revision,
 amount_total,currency,stripe_payment_status,livemode
) values
('evt_local_live_opening','cs_live_local_qa_opening',
 '00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
 1,30000,'GBP','paid',true),
('evt_local_mode_mismatch','cs_live_local_qa_wrong_mode',
 '00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
 1,30000,'GBP','paid',false);

select set_config('request.jwt.claim.role','service_role',true);

select throws_ok(
 $sql$select public.op_finalize_live_stripe_quote_payment('cs_live_local_qa_wrong_mode')$sql$,
 'A test-mode event can never create a live commercial project.',
 'Live finalizer rejects signed-looking test-mode evidence');

select is((select count(*)::integer from public.projects
 where quote_id='00000000-0000-4000-8000-000000009924'),0,
 'Test-mode live-looking event creates no project');

select lives_ok(
 $sql$select public.op_finalize_live_stripe_quote_payment('cs_live_local_qa_opening')$sql$,
 'Synthetic verified live £300 deposit releases one project without QA allowlist');
select is((select count(*)::integer from public.projects
 where quote_id='00000000-0000-4000-8000-000000009924'),1,
 'Live opening payment creates exactly one Project 360');
select is((select amount from public.quote_payment_confirmations
 where quote_id='00000000-0000-4000-8000-000000009924'),300::numeric,
 'Live opening receipt matches accepted £300, not £1,000');
select lives_ok(
 $sql$select public.op_finalize_live_stripe_quote_payment('cs_live_local_qa_opening')$sql$,
 'Replayed live opening event does not create another project');

-- Synthetic technical completion and accepted client review: fixture only.
alter table public.projects disable trigger user;
update public.projects set project_stage='client_review'
 where quote_id='00000000-0000-4000-8000-000000009924';
alter table public.projects enable trigger user;
alter table public.project_client_reviews disable trigger user;
insert into public.project_client_reviews(
 organisation_id,project_id,outcome,evidence_basis,evidence_reference,recorded_by
) select organisation_id,id,'accepted','client_portal','QA-LIVE-REVIEW-ACCEPTED',
 '00000000-0000-4000-8000-000000009921'
 from public.projects where quote_id='00000000-0000-4000-8000-000000009924';
alter table public.project_client_reviews enable trigger user;

insert into public.quote_stripe_payment_events(
 stripe_event_id,stripe_session_id,quote_id,organisation_id,quote_revision,
 amount_total,currency,stripe_payment_status,livemode
) values ('evt_local_live_final','cs_live_local_qa_final',
 '00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
 1,70000,'GBP','paid',true);

select lives_ok(
 $sql$select public.op_record_live_stripe_final_settlement(
  (select id from public.projects where quote_id='00000000-0000-4000-8000-000000009924'),
  'cs_live_local_qa_final')$sql$,
 'Synthetic live £700 balance reconciles only after the client accepts review');
select is((select count(*)::integer from public.op_project_final_settlements
 where quote_id='00000000-0000-4000-8000-000000009924'),1,
 'Verified live final settlement is unique');
select is((select count(*)::integer from public.op_project_final_release_approvals
 where project_id=(select id from public.projects where quote_id='00000000-0000-4000-8000-000000009924')),0,
 'Live full payment does not auto-approve editable file release');

select * from finish();
rollback;
