-- Strict paid-only Client and Partner dashboard regression.
-- Ephemeral CI database ONLY. Fixtures and JWT simulation rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000006101','qa-owner-portals@example.invalid'),
('00000000-0000-4000-8000-000000006102','qa-client-paid@example.invalid'),
('00000000-0000-4000-8000-000000006103','qa-client-unpaid@example.invalid'),
('00000000-0000-4000-8000-000000006104','qa-partner@example.invalid');

insert into public.organisations(id,name)
values ('00000000-0000-4000-8000-000000006110','OPOS isolated portal permissions');

insert into public.profiles(id,organisation_id,role,full_name)
values ('00000000-0000-4000-8000-000000006101',
'00000000-0000-4000-8000-000000006110','owner','Synthetic controller');

insert into public.companies(id,organisation_id,name,created_by) values
('00000000-0000-4000-8000-000000006121','00000000-0000-4000-8000-000000006110','QA Paid Company','00000000-0000-4000-8000-000000006101'),
('00000000-0000-4000-8000-000000006122','00000000-0000-4000-8000-000000006110','QA Unpaid Company','00000000-0000-4000-8000-000000006101');

insert into public.leads(id,organisation_id,created_by,company_name,company_id) values
('00000000-0000-4000-8000-000000006131','00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006101','QA Paid Company','00000000-0000-4000-8000-000000006121'),
('00000000-0000-4000-8000-000000006132','00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006101','QA Unpaid Company','00000000-0000-4000-8000-000000006122');

insert into public.quotes(id,organisation_id,lead_id,created_by,quote_number,total) values
('00000000-0000-4000-8000-000000006141','00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006131','00000000-0000-4000-8000-000000006101','QA-PORTAL-PAID',600.00),
('00000000-0000-4000-8000-000000006142','00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006132','00000000-0000-4000-8000-000000006101','QA-PORTAL-UNPAID',900.00);

-- Simulate existing projects, including a PO/no-advance-style exception: a
-- project alone is NOT evidence of payment and must NEVER enable a dashboard.
alter table public.projects disable trigger user;
insert into public.projects(id,organisation_id,lead_id,quote_id,created_by,project_number,title,project_stage) values
('00000000-0000-4000-8000-000000006151','00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006131','00000000-0000-4000-8000-000000006141','00000000-0000-4000-8000-000000006101','QA-PAID-01','Synthetic project with future payment','mobilisation'),
('00000000-0000-4000-8000-000000006152','00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006132','00000000-0000-4000-8000-000000006142','00000000-0000-4000-8000-000000006101','QA-UNPAID-02','Synthetic project without payment','mobilisation');
alter table public.projects enable trigger user;

insert into public.partners(id,organisation_id,company_name,status)
values ('00000000-0000-4000-8000-000000006161','00000000-0000-4000-8000-000000006110','QA Partner','approved');

insert into public.external_portal_memberships(organisation_id,auth_user_id,portal_kind,company_id,is_active) values
('00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006102','client','00000000-0000-4000-8000-000000006121',true),
('00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006103','client','00000000-0000-4000-8000-000000006122',true);
insert into public.external_portal_memberships(organisation_id,auth_user_id,portal_kind,partner_id,is_active) values
('00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006104','partner','00000000-0000-4000-8000-000000006161',true);

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006102',true);

select is((select count(*)::int from public.portal_my_projects('client')),0,
'Unpaid project remains invisible even with an active Client account');
select is((select count(*)::int from public.portal_my_workspaces()),1,
'Client identity can exist before payment without gaining projects');
select is((select count(*)::int from public.portal_my_projects('partner')),0,
'Client cannot query Partner work');

-- The only accepted paid evidence is a positive, verified finance receipt.
insert into public.quote_payment_confirmations(
 organisation_id,quote_id,lead_id,amount,currency,payment_method,payment_reference,confirmed_at,recorded_by
) values (
 '00000000-0000-4000-8000-000000006110','00000000-0000-4000-8000-000000006141',
 '00000000-0000-4000-8000-000000006131',180.00,'GBP','bank_transfer','QA-VERIFIED-ONLY',now(),
 '00000000-0000-4000-8000-000000006101'
);
select is((select count(*)::int from public.portal_my_projects('client')),1,
'Paid Client sees exactly their one verified project');
select is((select count(*)::int from public.portal_my_projects('client')
 where project_id='00000000-0000-4000-8000-000000006151'),1,
'Client project access is linked to the correct paid quote');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006103',true);
select is((select count(*)::int from public.portal_my_projects('client')),0,
'Other Client cannot see a paid project belonging to another company');

update public.external_portal_memberships set is_active=false where
 auth_user_id='00000000-0000-4000-8000-000000006102' and portal_kind='client';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006102',true);
select is((select count(*)::int from public.portal_my_projects('client')),0,
'Revoked Client membership loses paid dashboard immediately');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006104',true);
select is((select count(*)::int from public.portal_my_projects('partner')),0,
'Partner without issued and accepted Work Order has no dashboard');

select set_config('request.jwt.claim.role','anon',true);
select is((select count(*)::int from public.portal_my_projects('client')),0,
'Anonymous Client dashboard RPC returns no projects');
select is((select count(*)::int from public.portal_my_projects('partner')),0,
'Anonymous Partner dashboard RPC returns no projects');

select ok(not has_function_privilege('anon','public.portal_my_projects(text)','execute'),
'Anonymous users have no EXECUTE grant on dashboard RPC');
select ok(not has_table_privilege('authenticated','public.external_portal_memberships','select'),
'External membership table cannot be read directly with authenticated role');
select ok(has_function_privilege('authenticated','public.portal_my_projects(text)','execute'),
'Authenticated projects are exposed only through purpose-limited scoped RPC');


-- Legacy role collision: new grants must fail and any older overlapping grants
-- must be invisible to BOTH the landing-page and paid-project RPCs.
select throws_ok($sql$
 insert into public.external_portal_memberships
  (organisation_id,auth_user_id,portal_kind,company_id,is_active)
 values ('00000000-0000-4000-8000-000000006110',
         '00000000-0000-4000-8000-000000006101','client',
         '00000000-0000-4000-8000-000000006121',true)
$sql$,'P0001','External portal membership cannot use active Controller organisation profile',
   'New external grant cannot overlap an active internal Controller profile');

-- Reproduce a *legacy* grant that predates the trigger; no persisted changes
-- because this pgTAP test runs in a rolled-back transaction.
alter table public.external_portal_memberships disable trigger op_validate_external_portal_membership_trigger;
insert into public.external_portal_memberships
 (organisation_id,auth_user_id,portal_kind,company_id,is_active)
 values ('00000000-0000-4000-8000-000000006110',
         '00000000-0000-4000-8000-000000006101','client',
         '00000000-0000-4000-8000-000000006121',true);
alter table public.external_portal_memberships enable trigger op_validate_external_portal_membership_trigger;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006101',true);
select is((select count(*)::int from public.portal_my_workspaces()),0,
'Legacy grant with active Controller profile cannot reveal external account');
select is((select count(*)::int from public.portal_my_projects('client')),0,
'Legacy grant with active Controller profile cannot reveal even a paid project');

select is(public.portal_identity_conflict(),true,
'Existing active Controller/external membership collision is detected at login');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006103',true);
select is(public.portal_identity_conflict(),false,
'Unpaid but non-overlapping Client identity is not falsely classified as an internal collision');

select * from finish();
rollback;