-- OPOS-QA protected Client Review decision matrix.
-- RUN ONLY using the Supabase SQL runner for QA project ukcamenuxhdznxaxpyis.
-- NEVER execute against production. No email, customer account creation, payment or file release.
--
-- Every scenario deliberately raises QA001 within an EXCEPTION subtransaction,
-- rolling back ALL decision, activity, classification and canonical-project writes.
-- This uses the existing, undecided fictional Northfield R01 fixture; it WILL
-- fail closed after that fixture has a real QA decision. Do not delete/reset it.
--
-- The QA SQL runner simulates auth.uid() through LOCAL JWT claims. This checks
-- real DB RPC behavior, NOT real browser session handling or visual interaction.
-- No permanent SQL function, data, trigger, or RLS policy is created.

-- 1. Four independently rolled-back, attributed CLIENT RPC outcomes
DO $qa_client$
DECLARE
  v_project CONSTANT uuid:='b447f586-bf79-4839-be5e-1af607d9ca43';
  v_client CONSTANT uuid:='d85dd263-bea3-4204-b219-da079b656dcf';
  v_issue uuid; v_outcome text; v_comments text; v_response jsonb; v_position jsonb; v_count int;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.projects
     WHERE id=v_project AND organisation_id='717262cb-68da-4e7b-a9fa-238dc6c5d16b'
       AND project_stage='client_review') THEN RAISE EXCEPTION 'QA R01 baseline missing';END IF;
  SELECT i.id INTO v_issue FROM public.op_qa_client_review_issues i
   JOIN public.external_portal_memberships m ON m.id=i.membership_id
   WHERE i.project_id=v_project AND i.execution_cycle=1
    AND m.auth_user_id=v_client AND m.is_active AND m.portal_kind='client';
  IF v_issue IS NULL OR EXISTS(SELECT 1 FROM public.op_qa_client_review_decisions WHERE issue_id=v_issue)
   THEN RAISE EXCEPTION 'QA R01 already decided or unassigned; refusing scenario tests';END IF;
  PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  FOR v_outcome,v_comments IN SELECT * FROM (VALUES
    ('accepted'::text,''::text),
    ('accepted_with_comments'::text,'The test drawings are accepted with documented technical comments.'),
    ('changes_requested'::text,'Revise and resubmit the fixture hole centre dimension.'),
    ('rejected'::text,'The specified tolerance fails the client QA acceptance criteria.')
  ) t(outcome,comments)
  LOOP
   BEGIN
    v_response:=public.op_qa_record_client_review_decision(v_project,v_outcome,v_comments);
    IF (v_response->>'recorded')::boolean IS DISTINCT FROM true OR
       (v_response->>'pendingOpReconciliation')::boolean IS DISTINCT FROM true
      THEN RAISE EXCEPTION 'Incorrect decision result for %',v_outcome;END IF;
    SELECT count(*) INTO v_count FROM public.op_qa_client_review_decisions d
     WHERE d.issue_id=v_issue AND d.decided_by=v_client AND d.outcome=v_outcome
      AND (v_outcome='accepted' OR d.comments=v_comments);
    IF v_count<>1 THEN RAISE EXCEPTION 'Attribution/comments failure for %',v_outcome;END IF;
    v_position:=public.op_qa_client_review_position(v_project);
    IF v_position->>'decision' IS DISTINCT FROM v_outcome OR
       (v_position->>'canRespond')::boolean IS DISTINCT FROM false
      THEN RAISE EXCEPTION 'Client display state failure for %',v_outcome;END IF;
    BEGIN
     PERFORM public.op_qa_record_client_review_decision(v_project,v_outcome,v_comments);
     RAISE EXCEPTION 'Duplicate client submission was accepted';
    EXCEPTION WHEN OTHERS THEN
     IF SQLERRM NOT LIKE '%already has a recorded decision%' THEN RAISE;END IF;
    END;
    IF EXISTS(SELECT 1 FROM public.project_client_reviews
      WHERE project_id=v_project AND execution_cycle=1)
      THEN RAISE EXCEPTION 'Client response self-reconciled without OP';END IF;
    RAISE EXCEPTION USING ERRCODE='QA001',MESSAGE='EXPECTED_ROLLBACK_CLIENT_SCENARIO';
   EXCEPTION WHEN SQLSTATE 'QA001' THEN NULL; -- Rolls back that single case.
   END;
   IF EXISTS(SELECT 1 FROM public.op_qa_client_review_decisions WHERE issue_id=v_issue)
    THEN RAISE EXCEPTION 'Rollback failed for %',v_outcome;END IF;
  END LOOP;
END $qa_client$;

-- 2. OPERATOR outcome handling, one separate rollback scenario per response.
-- The client RPC is exercised in section 1. Here we stage its exact attributed
-- immutable decision row transactionally, then invoke the real governed OP RPC.
DO $qa_operator$
DECLARE
  v_project CONSTANT uuid:='b447f586-bf79-4839-be5e-1af607d9ca43';
  v_client CONSTANT uuid:='d85dd263-bea3-4204-b219-da079b656dcf';
  v_operator CONSTANT uuid:='8d01a806-f6ff-475b-aafb-cb4a00743a75';
  v_org CONSTANT uuid:='717262cb-68da-4e7b-a9fa-238dc6c5d16b';
  v_issue uuid;v_outcome text;v_comments text;v_response jsonb;v_count int;
BEGIN
  SELECT id INTO v_issue FROM public.op_qa_client_review_issues WHERE project_id=v_project;
  IF v_issue IS NULL OR EXISTS(SELECT 1 FROM public.op_qa_client_review_decisions WHERE issue_id=v_issue)
    THEN RAISE EXCEPTION 'QA R01 baseline already decided';END IF;
  PERFORM set_config('request.jwt.claim.sub',v_operator::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM public.op_assert_membership(v_org,v_operator);
  FOR v_outcome,v_comments IN SELECT * FROM (VALUES
    ('accepted'::text,''::text),
    ('accepted_with_comments'::text,'Acceptance with manufacturing comments recorded in QA.'),
    ('changes_requested'::text,'Adjust the fixture hole locations and resubmit.'),
    ('rejected'::text,'The review drawing is unacceptable at the stated tolerances.')
  ) t(outcome,comments)
  LOOP
   BEGIN
    INSERT INTO public.op_qa_client_review_decisions(
      organisation_id,project_id,issue_id,decided_by,outcome,comments)
    VALUES (v_org,v_project,v_issue,v_client,v_outcome,nullif(v_comments,''));
    IF v_outcome IN ('accepted','accepted_with_comments') THEN
      v_response:=public.op_qa_reconcile_client_review_decision(v_project);
      IF (v_response->>'reconciled')::boolean IS DISTINCT FROM true
        THEN RAISE EXCEPTION 'Operator reconciliation failed %',v_outcome;END IF;
      SELECT count(*) INTO v_count FROM public.project_client_reviews
       WHERE project_id=v_project AND outcome=v_outcome AND evidence_basis='client_portal';
      IF v_count<>1 THEN RAISE EXCEPTION 'Canonical outcome missing %',v_outcome;END IF;
    ELSE
      BEGIN
        PERFORM public.op_qa_reconcile_client_review_decision(v_project);
        RAISE EXCEPTION 'Unclassified correction/rejection bypassed classification';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%scope classification%' THEN RAISE;END IF;
      END;
      IF EXISTS(SELECT 1 FROM public.project_client_reviews WHERE project_id=v_project)
        THEN RAISE EXCEPTION 'Unclassified correction created canonical outcome';END IF;
      IF v_outcome='changes_requested' THEN
        v_response:=public.op_qa_classify_and_resolve_client_feedback(
          v_project,'included_correction',
          'One included in-scope drawing correction is available within the accepted commercial scope.',
          'Update R01 fixture mounting dimension and submit a corrected R02 drawing for OP review.');
        IF v_response->>'projectStage'<>'partner_correction'
          THEN RAISE EXCEPTION 'Included correction did not open partner correction';END IF;
      ELSE
        v_response:=public.op_qa_classify_and_resolve_client_feedback(
          v_project,'variation',
          'Requested changes differ from the approved original contractual scope and require approval.',null);
        IF v_response->>'projectStage'<>'client_review' OR
           (v_response->>'partnerInstructed')::boolean IS DISTINCT FROM false OR
           (v_response->>'variationApprovalRequired')::boolean IS DISTINCT FROM true
         THEN RAISE EXCEPTION 'Rejection variation bypassed commercial approval';END IF;
      END IF;
    END IF;
    RAISE EXCEPTION USING ERRCODE='QA001',MESSAGE='EXPECTED_ROLLBACK_OPERATOR_SCENARIO';
   EXCEPTION WHEN SQLSTATE 'QA001' THEN NULL;
   END;
   IF EXISTS(SELECT 1 FROM public.op_qa_client_review_decisions WHERE issue_id=v_issue)
    THEN RAISE EXCEPTION 'OP scenario rollback failed %',v_outcome;END IF;
  END LOOP;
END $qa_operator$;

-- 3. Negative cases: independent, unauthorized identity and short feedback
DO $qa_negative$
DECLARE
  v_project CONSTANT uuid:='b447f586-bf79-4839-be5e-1af607d9ca43';
  v_client CONSTANT uuid:='d85dd263-bea3-4204-b219-da079b656dcf';
  v_operator CONSTANT uuid:='8d01a806-f6ff-475b-aafb-cb4a00743a75';
BEGIN
 PERFORM set_config('request.jwt.claim.role','authenticated',true);
 PERFORM set_config('request.jwt.claim.sub',v_operator::text,true);
 BEGIN
  PERFORM public.op_qa_record_client_review_decision(v_project,'accepted','');
  RAISE EXCEPTION 'OP staff was able to impersonate client';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%OP staff account cannot submit%' THEN RAISE;END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',v_client::text,true);
 BEGIN
  PERFORM public.op_qa_record_client_review_decision(v_project,'changes_requested','too short');
  RAISE EXCEPTION 'Missing required comments was allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%at least twelve characters%' THEN RAISE;END IF;
 END;
 BEGIN
  PERFORM public.op_qa_record_client_review_decision(v_project,'invalid_qa_choice','A valid test comment');
  RAISE EXCEPTION 'Invalid outcome was allowed';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Select an explicit review decision%' THEN RAISE;END IF;
 END;
END $qa_negative$;

-- Only reaches PASS if all RPC and rollback assertions succeeded.
SELECT 'PASS' AS qa_client_review_outcome_matrix,
  4 AS distinct_client_outcomes,
  4 AS independent_client_rollback_cases,
  4 AS independent_operator_rollback_cases,
  3 AS negative_cases,
  (SELECT count(*) FROM public.op_qa_client_review_decisions
     WHERE project_id='b447f586-bf79-4839-be5e-1af607d9ca43') AS persisted_decisions,
  (SELECT project_stage FROM public.projects
     WHERE id='b447f586-bf79-4839-be5e-1af607d9ca43') AS original_stage;
