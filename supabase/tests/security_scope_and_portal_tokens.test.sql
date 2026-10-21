-- Release security regression checks. Ephemeral local Supabase DB only.
-- Never invokes Stripe or sends mail; synthetic rows are rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(18);

-- A bare, unapproved project must report the missing Scope of Work explicitly.
ALTER TABLE public.projects DISABLE TRIGGER USER;
INSERT INTO auth.users (id,email)
VALUES ('00000000-0000-4000-8000-000000008911','security-qa-owner@example.invalid');
INSERT INTO public.organisations(id,name)
VALUES ('00000000-0000-4000-8000-000000008912','OP QA SECURITY SCOPE');
INSERT INTO public.profiles(id,organisation_id,role,full_name)
VALUES ('00000000-0000-4000-8000-000000008911',
        '00000000-0000-4000-8000-000000008912','owner','Security QA');
INSERT INTO public.leads(id,organisation_id,created_by,company_name)
VALUES ('00000000-0000-4000-8000-000000008913',
        '00000000-0000-4000-8000-000000008912',
        '00000000-0000-4000-8000-000000008911','OP QA SCOPE');
INSERT INTO public.technical_intakes(id,organisation_id,lead_id,description,created_by)
VALUES ('00000000-0000-4000-8000-000000008922',
        '00000000-0000-4000-8000-000000008912',
        '00000000-0000-4000-8000-000000008913','Synthetic QA intake',
        '00000000-0000-4000-8000-000000008911');
INSERT INTO public.projects(id,organisation_id,lead_id,created_by,project_number,title,project_stage)
VALUES ('00000000-0000-4000-8000-000000008914',
        '00000000-0000-4000-8000-000000008912',
        '00000000-0000-4000-8000-000000008913',
        '00000000-0000-4000-8000-000000008911',
        'OP-QA-SCOPE-01','Synthetic missing-scope gate','mobilisation');
ALTER TABLE public.projects ENABLE TRIGGER USER;

SELECT ok(
  (public.op_project_stage_readiness('00000000-0000-4000-8000-000000008914')->'reasons')
      ? 'Approved Scope of Work is required.',
  'Readiness must retain the missing approved Scope of Work blocker');
SELECT ok(
  (public.op_project_stage_readiness('00000000-0000-4000-8000-000000008914')->'reasons')
      ? 'Approved Statement of Work is required.',
  'Readiness must retain the missing approved Statement of Work blocker');
SELECT is(
  (public.op_project_stage_readiness('00000000-0000-4000-8000-000000008914')->>'ready')::boolean,
  false,
  'Project cannot progress from mobilisation without approved scope');

SELECT ok(NOT has_function_privilege('anon',
 'public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)','EXECUTE'),
 'Anonymous users cannot invoke unscoped readiness implementation');
SELECT ok(NOT has_function_privilege('authenticated',
 'public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)','EXECUTE'),
 'Signed-in users cannot invoke unscoped readiness implementation');
SELECT ok(NOT has_function_privilege('anon',
 'public.op_finalize_live_stripe_quote_payment(text)','EXECUTE'),
 'Anonymous users cannot reconcile live opening payment');
SELECT ok(NOT has_function_privilege('authenticated',
 'public.op_finalize_live_stripe_quote_payment(text)','EXECUTE'),
 'Signed-in users cannot reconcile live opening payment');

-- The three deliberate bearer-token portal RPCs must reject unknown tokens.
SELECT is(
 (SELECT count(*)::int FROM public.op_public_invoice_by_token(
    '00000000-0000-4000-8000-000000008915'::uuid)),
 0,
 'Unknown public invoice token exposes no invoice');
SELECT throws_ok(
 $sql$ SELECT public.op_submit_partner_review_response('nonexistent-review-token','{}'::jsonb) $sql$,
 'Invalid review token',
 'Partner review response requires a valid token hash');
SELECT throws_ok(
 $sql$ SELECT public.op_submit_prospect_partner_review_response('nonexistent-review-token','{}'::jsonb) $sql$,
 'Invalid Prospect partner-review token',
 'Prospect review response requires a valid token hash');
SELECT ok(
 EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='invoices' AND column_name='public_token'
  AND column_default LIKE '%gen_random_uuid%'),
 'Public invoice bearer token defaults to cryptographically random UUID');
SELECT ok(
 NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id IN ('partner-delivery','technical-intake') AND public),
 'Engineering and intake storage buckets are private');
SELECT ok(
 NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity),
 'Every public application table has RLS enabled');
SELECT ok(
 NOT has_function_privilege('anon','public.op_developer_delete_test_record(text,uuid)','EXECUTE'),
 'Developer deletion is not anonymously callable');

-- Exercise expiry and revocation with rollback-only bearer-token fixtures.
INSERT INTO public.partners(id,organisation_id,company_name,nda_signed)
VALUES ('00000000-0000-4000-8000-000000008916',
        '00000000-0000-4000-8000-000000008912','Security QA Partner',true);
INSERT INTO public.prospects(id,organisation_id,created_by,company_name)
VALUES ('00000000-0000-4000-8000-000000008917',
        '00000000-0000-4000-8000-000000008912',
        '00000000-0000-4000-8000-000000008911','Security QA Prospect');
INSERT INTO public.intake_sessions(
 id,organisation_id,prospect_id,token_hash,expires_at,created_by)
VALUES ('00000000-0000-4000-8000-000000008923',
        '00000000-0000-4000-8000-000000008912',
        '00000000-0000-4000-8000-000000008917',
        'security_qa_intake_session',now()+interval '2 days',
        '00000000-0000-4000-8000-000000008911');
ALTER TABLE public.partner_review_requests DISABLE TRIGGER USER;
INSERT INTO public.partner_review_requests(
 id,organisation_id,lead_id,technical_intake_id,partner_id,token_hash,case_reference,status,
 response_due_at,expires_at,scope_summary,created_by)
VALUES
 ('00000000-0000-4000-8000-000000008918',
  '00000000-0000-4000-8000-000000008912',
  '00000000-0000-4000-8000-000000008913',
  '00000000-0000-4000-8000-000000008922',
  '00000000-0000-4000-8000-000000008916',
  'security_qa_expired_lead','SEC-QA-LEAD-1','invited',
  now()-interval '2 days',now()-interval '1 day','QA expired review',
  '00000000-0000-4000-8000-000000008911'),
 ('00000000-0000-4000-8000-000000008919',
  '00000000-0000-4000-8000-000000008912',
  '00000000-0000-4000-8000-000000008913',
  '00000000-0000-4000-8000-000000008922',
  '00000000-0000-4000-8000-000000008916',
  'security_qa_revoked_lead','SEC-QA-LEAD-2','revoked',
  now()+interval '1 day',now()+interval '2 days','QA revoked review',
  '00000000-0000-4000-8000-000000008911');
INSERT INTO public.partner_review_requests(
 id,organisation_id,prospect_id,intake_session_id,partner_id,token_hash,case_reference,status,
 response_due_at,expires_at,scope_summary,created_by)
VALUES
 ('00000000-0000-4000-8000-000000008920',
  '00000000-0000-4000-8000-000000008912',
  '00000000-0000-4000-8000-000000008917',
  '00000000-0000-4000-8000-000000008923',
  '00000000-0000-4000-8000-000000008916',
  'security_qa_expired_prospect','SEC-QA-PROS-1','invited',
  now()-interval '2 days',now()-interval '1 day','QA expired prospect review',
  '00000000-0000-4000-8000-000000008911'),
 ('00000000-0000-4000-8000-000000008921',
  '00000000-0000-4000-8000-000000008912',
  '00000000-0000-4000-8000-000000008917',
  '00000000-0000-4000-8000-000000008923',
  '00000000-0000-4000-8000-000000008916',
  'security_qa_revoked_prospect','SEC-QA-PROS-2','revoked',
  now()+interval '1 day',now()+interval '2 days','QA revoked prospect review',
  '00000000-0000-4000-8000-000000008911');
ALTER TABLE public.partner_review_requests ENABLE TRIGGER USER;
SELECT throws_ok(
 $sql$SELECT public.op_submit_partner_review_response('security_qa_expired_lead','{}'::jsonb)$sql$,
 'Review link has expired',
 'Expired partner-review token is rejected');
SELECT throws_ok(
 $sql$SELECT public.op_submit_partner_review_response('security_qa_revoked_lead','{}'::jsonb)$sql$,
 'Review is closed',
 'Revoked partner-review token is rejected');
SELECT throws_ok(
 $sql$SELECT public.op_submit_prospect_partner_review_response('security_qa_expired_prospect','{}'::jsonb)$sql$,
 'Review link has expired',
 'Expired prospect partner-review token is rejected');
SELECT throws_ok(
 $sql$SELECT public.op_submit_prospect_partner_review_response('security_qa_revoked_prospect','{}'::jsonb)$sql$,
 'Review is closed',
 'Revoked prospect partner-review token is rejected');

SELECT * FROM finish();
ROLLBACK;
