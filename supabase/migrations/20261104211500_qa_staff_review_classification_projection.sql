-- Read-only OP client review state includes authorised feedback classification.
CREATE OR REPLACE FUNCTION public.op_qa_staff_client_review_state(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user uuid:=auth.uid();v_org uuid;v_role text;v_issue public.op_qa_client_review_issues%rowtype;
 v_decision public.op_qa_client_review_decisions%rowtype;v_cycle int;
 v_classification text;v_change_id uuid;v_instruction text;
begin
 select organisation_id into v_org from public.projects where id=p_project_id;
 select role::text into v_role from public.profiles
 where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin','operator','engineering')
 then raise exception 'Authorised OP role required'; end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
 where a.project_id=p_project_id and a.organisation_id=v_org and a.execution_state not in ('closed','cancelled')
 order by a.created_at desc limit 1;
 select * into v_issue from public.op_qa_client_review_issues
 where project_id=p_project_id and organisation_id=v_org and execution_cycle=v_cycle
 order by issued_at desc limit 1;
 if v_issue.id is not null then
   select * into v_decision from public.op_qa_client_review_decisions where issue_id=v_issue.id;
 end if;
 if v_decision.id is not null then
   select c.classification,c.change_request_id,c.partner_instruction
     into v_classification,v_change_id,v_instruction
   from public.op_qa_client_correction_classifications c
   where c.issue_id=v_issue.id and c.decision_id=v_decision.id;
 end if;
 return jsonb_build_object('issued',v_issue.id is not null,'issueId',v_issue.id,
  'feedbackClassification',v_classification,'variationChangeRequestId',v_change_id,
  'approvedPartnerInstruction',v_instruction,
 'revision',v_issue.revision,'decisionId',v_decision.id,'decision',v_decision.outcome,
 'decisionComments',v_decision.comments,'decidedAt',v_decision.decided_at,
 'clientAttestationPending',v_issue.id is not null and v_decision.id is null,
 'opReconciliationRequired',v_decision.id is not null and
 not exists(select 1 from public.project_client_reviews r
  where r.project_id=p_project_id and r.organisation_id=v_org
  and r.execution_cycle=v_cycle and r.evidence_reference='QA-PORTAL/'||v_decision.id::text));
end $function$
;
