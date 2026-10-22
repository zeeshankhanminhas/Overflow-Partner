-- Isolated, transaction-rolled-back proof that cold LinkedIn names never enter CRM.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

SELECT ok(to_regclass('public.linkedin_outreach_threads') is not null,
 'Separate pre-CRM thread table exists');
SELECT ok(to_regclass('public.linkedin_outreach_messages') is not null,
 'Conversation archive exists without requiring a Prospect');
SELECT ok(
 (select relrowsecurity from pg_class where oid='public.linkedin_outreach_threads'::regclass)
 and (select relrowsecurity from pg_class where oid='public.linkedin_outreach_messages'::regclass),
 'Tenant RLS is enabled on both');
SELECT ok(
 not has_table_privilege('anon','public.linkedin_outreach_threads','SELECT')
 and not has_table_privilege('anon','public.linkedin_outreach_messages','SELECT'),
 'Anonymous clients cannot read outreach');

INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-000000007101','outreach-a@example.invalid'),
 ('00000000-0000-4000-8000-000000007102','outreach-b@example.invalid'),
 ('00000000-0000-4000-8000-000000007103','outreach-viewer@example.invalid');
INSERT INTO public.organisations(id,name) VALUES
 ('00000000-0000-4000-8000-000000007111','QA PRECRM A'),
 ('00000000-0000-4000-8000-000000007112','QA PRECRM B');
INSERT INTO public.profiles(id,organisation_id,role,full_name) VALUES
 ('00000000-0000-4000-8000-000000007101','00000000-0000-4000-8000-000000007111','owner','QA Owner A'),
 ('00000000-0000-4000-8000-000000007102','00000000-0000-4000-8000-000000007112','owner','QA Owner B'),
 ('00000000-0000-4000-8000-000000007103','00000000-0000-4000-8000-000000007111','viewer','QA Viewer A');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007101',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

SELECT lives_ok($sql$
 INSERT INTO public.linkedin_outreach_threads(id,organisation_id,created_by,company_name,contact_name,linkedin_url)
 VALUES ('00000000-0000-4000-8000-000000007121','00000000-0000-4000-8000-000000007111',
 '00000000-0000-4000-8000-000000007101','QA Cold Company','QA Contact','https://www.linkedin.com/in/qa-precrm-a')
$sql$, 'Cold name can be added only to outreach');

SELECT is((select count(*)::int from public.companies
 where organisation_id='00000000-0000-4000-8000-000000007111'),0,'No Company was created');
SELECT is((select count(*)::int from public.contacts
 where organisation_id='00000000-0000-4000-8000-000000007111'),0,'No Contact was created');
SELECT is((select count(*)::int from public.prospects
 where organisation_id='00000000-0000-4000-8000-000000007111'),0,'No Prospect was created');

SELECT lives_ok($sql$
 INSERT INTO public.linkedin_outreach_messages(organisation_id,outreach_id,created_by,source,body)
 VALUES ('00000000-0000-4000-8000-000000007111',
 '00000000-0000-4000-8000-000000007121','00000000-0000-4000-8000-000000007101',
 'sales_navigator','You: Hello'||chr(10)||'Prospect: Good afternoon')
$sql$, 'Full pasted conversation can be saved without CRM');

SELECT throws_like($sql$
 SELECT public.op_promote_linkedin_outreach('00000000-0000-4000-8000-000000007121')
$sql$, '%Confirm an interested reply%', 'Cannot promote unqualified LinkedIn contact');

SELECT lives_ok($sql$
 UPDATE public.linkedin_outreach_threads SET state='interested'
 WHERE id='00000000-0000-4000-8000-000000007121'
$sql$, 'Owner records a confirmed interested reply');

SELECT ok(
 (select public.op_promote_linkedin_outreach('00000000-0000-4000-8000-000000007121')) is not null,
 'Confirmed interest promotes atomically');
SELECT is((select count(*)::int from public.prospects
 where organisation_id='00000000-0000-4000-8000-000000007111'),1,
 'Exactly one CRM Prospect exists after interest');
SELECT is(
 (select public.op_promote_linkedin_outreach('00000000-0000-4000-8000-000000007121'))::text,
 (select crm_prospect_id::text from public.linkedin_outreach_threads
  where id='00000000-0000-4000-8000-000000007121'),
 'Repeated conversion returns the same Prospect');

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007103',true);
SELECT is((select count(*)::int from public.linkedin_outreach_messages),0,
 'Viewer cannot read copied private conversations');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000007102',true);
SELECT is((select count(*)::int from public.linkedin_outreach_threads),0,
 'Different organisation cannot access threads');

SELECT * FROM finish();
ROLLBACK;
