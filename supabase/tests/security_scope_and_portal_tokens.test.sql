-- Release security regression checks. Ephemeral local Supabase DB only.
-- Never invokes Stripe or sends mail; synthetic rows are rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(14);

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

SELECT * FROM finish();
ROLLBACK;
