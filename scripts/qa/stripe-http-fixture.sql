-- Synthetic approved £1,000 quote / £300 deposit fixture for disposable local HTTP QA.
-- This file must NEVER run against any hosted Supabase project.
begin;
alter table public.quotes disable trigger user;
alter table public.documents disable trigger user;
alter table public.quote_issue_records disable trigger user;

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
insert into public.quotes(
  id,organisation_id,lead_id,quote_number,revision,total,subtotal,vat,currency,created_by,status,valid_until
) values ('00000000-0000-4000-8000-000000009924','00000000-0000-4000-8000-000000009922',
'00000000-0000-4000-8000-000000009923','OP-QA-HTTP-1',1,1000,1000,0,'GBP',
'00000000-0000-4000-8000-000000009921','issued',current_date+14);
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
alter table public.quote_issue_records enable trigger user;
commit;
