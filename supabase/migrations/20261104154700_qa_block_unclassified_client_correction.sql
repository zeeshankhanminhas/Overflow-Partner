-- QA fail-closed: no automatic partner correction for unclassified client review feedback.
CREATE OR REPLACE FUNCTION public.op_qa_reconcile_client_review_decision(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user uuid:=auth.uid();v_org uuid;v_stage text;v_role text;
 v_issue public.op_qa_client_review_issues%rowtype;v_decision public.op_qa_client_review_decisions%rowtype;
 v_cycle int;v_result jsonb;
begin
 select organisation_id,project_stage into v_org,v_stage from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin','operator','engineering') or v_stage<>'client_review'
 then raise exception 'Authorised OP reviewer in Client Review required'; end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
 where a.project_id=p_project_id and a.organisation_id=v_org and a.execution_state not in ('closed','cancelled')
 order by a.created_at desc limit 1;
 select * into v_issue from public.op_qa_client_review_issues where project_id=p_project_id
 and organisation_id=v_org and execution_cycle=v_cycle;
 if v_issue.id is null then raise exception 'No current-cycle protected client issue exists'; end if;
 select * into v_decision from public.op_qa_client_review_decisions where issue_id=v_issue.id;
 if v_decision.id is null then raise exception 'Client has not yet submitted an authenticated decision'; end if;
 if v_decision.outcome in ('changes_requested','rejected') then
  raise exception 'Client correction requests require OP scope classification before partner work can be instructed';
 end if;
 if exists(select 1 from public.project_client_reviews where project_id=p_project_id
 and organisation_id=v_org and execution_cycle=v_cycle)
 then raise exception 'The current-cycle client outcome has already been recorded'; end if;
 v_result:=public.op_record_client_review_outcome_core(
   v_org,v_user,p_project_id,v_decision.outcome,'client_portal',
   'QA-PORTAL/'||v_decision.id::text,v_decision.comments
 );
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'client_review.external_decision_reconciled',
 jsonb_build_object('clientDecisionId',v_decision.id,'outcome',v_decision.outcome));
 return v_result || jsonb_build_object('reconciled',true,'externalDecisionId',v_decision.id);
end $function$
;
