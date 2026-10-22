-- Isolated, transaction-rolled-back QA for manual LinkedIn conversation archive.
-- No live prospect records or external services are touched.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

SELECT ok(to_regclass('public.prospect_conversation_imports') IS NOT NULL,
  'Conversation import table was migrated');
SELECT ok(to_regclass('public.prospect_conversation_messages') IS NOT NULL,
  'Conversation message table was migrated');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.prospect_conversation_imports'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid='public.prospect_conversation_messages'::regclass),
  'RLS is enabled on both conversation tables');
SELECT ok(
  NOT has_table_privilege('anon','public.prospect_conversation_imports','SELECT')
  AND NOT has_table_privilege('anon','public.prospect_conversation_messages','SELECT'),
  'Anonymous users cannot read archived conversations');
SELECT ok(
  NOT has_table_privilege('authenticated','public.prospect_conversation_imports','UPDATE')
  AND NOT has_table_privilege('authenticated','public.prospect_conversation_messages','DELETE'),
  'Authenticated operators cannot silently rewrite or delete evidence');

INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-000000006201','conversation-user-a@example.invalid'),
 ('00000000-0000-4000-8000-000000006202','conversation-user-b@example.invalid');
INSERT INTO public.organisations(id,name) VALUES
 ('00000000-0000-4000-8000-000000006211','Conversation QA Organisation A'),
 ('00000000-0000-4000-8000-000000006212','Conversation QA Organisation B');
INSERT INTO public.profiles(id,organisation_id,role,full_name) VALUES
 ('00000000-0000-4000-8000-000000006201','00000000-0000-4000-8000-000000006211','owner','QA Owner A'),
 ('00000000-0000-4000-8000-000000006202','00000000-0000-4000-8000-000000006212','owner','QA Owner B');
INSERT INTO public.prospects(id,organisation_id,created_by,company_name,source) VALUES
 ('00000000-0000-4000-8000-000000006221','00000000-0000-4000-8000-000000006211','00000000-0000-4000-8000-000000006201','QA LinkedIn A','linkedin'),
 ('00000000-0000-4000-8000-000000006222','00000000-0000-4000-8000-000000006212','00000000-0000-4000-8000-000000006202','QA LinkedIn B','linkedin');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006201',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

SELECT lives_ok($sql$
 INSERT INTO public.prospect_conversation_imports
  (id,organisation_id,prospect_id,source,original_text,content_hash,imported_by)
 VALUES
  ('00000000-0000-4000-8000-000000006231',
   '00000000-0000-4000-8000-000000006211',
   '00000000-0000-4000-8000-000000006221',
   'linkedin','You: Hello'||chr(10)||'Prospect: Hello',
   repeat('a',64),
   '00000000-0000-4000-8000-000000006201')
$sql$, 'Authenticated member can archive their own prospect conversation');

SELECT lives_ok($sql$
 INSERT INTO public.prospect_conversation_messages
  (organisation_id,prospect_id,import_id,source,speaker,body,original_order,message_fingerprint,imported_by)
 VALUES
  ('00000000-0000-4000-8000-000000006211',
   '00000000-0000-4000-8000-000000006221',
   '00000000-0000-4000-8000-000000006231',
   'linkedin','prospect','Hello',0,repeat('b',64),
   '00000000-0000-4000-8000-000000006201')
$sql$, 'Authenticated member can archive a message of their own import');

SELECT is(
 (SELECT count(*)::integer FROM public.prospect_conversation_messages),1,
 'Organisation A reads only its one archived message');

SELECT throws_like($sql$
 INSERT INTO public.prospect_conversation_imports
  (organisation_id,prospect_id,source,original_text,content_hash,imported_by)
 VALUES
  ('00000000-0000-4000-8000-000000006212',
   '00000000-0000-4000-8000-000000006222',
   'linkedin','Unowned transcript',repeat('c',64),
   '00000000-0000-4000-8000-000000006201')
$sql$, '%row-level security%', 'Org A cannot import against org B prospect');

SELECT throws_like($sql$
 INSERT INTO public.prospect_conversation_messages
  (organisation_id,prospect_id,import_id,source,speaker,body,original_order,message_fingerprint,imported_by)
 VALUES
  ('00000000-0000-4000-8000-000000006212',
   '00000000-0000-4000-8000-000000006222',
   '00000000-0000-4000-8000-000000006231',
   'linkedin','prospect','Hijack',0,repeat('c',64),
   '00000000-0000-4000-8000-000000006201')
$sql$, '%row-level security%', 'Org A cannot attach a message to another org');

SELECT throws_like($sql$
 INSERT INTO public.prospect_conversation_messages
  (organisation_id,prospect_id,import_id,source,speaker,body,original_order,message_fingerprint,imported_by)
 VALUES
  ('00000000-0000-4000-8000-000000006211',
   '00000000-0000-4000-8000-000000006221',
   '00000000-0000-4000-8000-000000006231',
   'linkedin','prospect','Hello again',1,repeat('b',64),
   '00000000-0000-4000-8000-000000006201')
$sql$, '%duplicate key%', 'Exact duplicate message fingerprint cannot create a second record');

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000006202',true);
SELECT is(
 (SELECT count(*)::integer FROM public.prospect_conversation_messages),0,
 'Organisation B cannot see organisation A message');

SELECT * FROM finish();
ROLLBACK;
