-- External Client Portal identities are auth.users, not internal OP profiles.
-- Keep the authenticated actor in event_data and use null staff user_id for the event foreign key.
CREATE OR REPLACE FUNCTION public.op_qa_record_client_review_decision(p_project_id uuid, p_outcome text, p_comments text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user uuid:=auth.uid();v_project public.projects%rowtype;
 v_issue public.op_qa_client_review_issues%rowtype;v_cycle int;v_id uuid;
begin
 if v_user is null then raise exception 'A signed-in Client Portal account is required'; end if;
 select * into v_project from public.projects where id=p_project_id for update;
 if v_project.id is null or v_project.project_stage<>'client_review'
 then raise exception 'The project is not currently accepting Client Review decisions'; end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
 where a.project_id=p_project_id and a.organisation_id=v_project.organisation_id
 and a.execution_state not in ('closed','cancelled') order by a.created_at desc limit 1;
 select i.* into v_issue from public.op_qa_client_review_issues i
 join public.external_portal_memberships m on m.id=i.membership_id
 join public.leads l on l.id=v_project.lead_id and l.company_id=m.company_id
   and l.organisation_id=v_project.organisation_id
 where i.project_id=p_project_id and i.organisation_id=v_project.organisation_id
 and i.execution_cycle=v_cycle and m.auth_user_id=v_user
 and m.organisation_id=v_project.organisation_id and m.is_active=true and m.portal_kind='client'
 for update of i;
 if v_issue.id is null then raise exception 'Your Client Portal account has no authorised current review'; end if;
 if not exists(select 1 from public.partner_delivery_submissions s
   where s.id=v_issue.submission_id and s.project_id=p_project_id
   and s.organisation_id=v_issue.organisation_id and s.execution_cycle=v_cycle
   and s.review_status='accepted')
 then raise exception 'Current approved engineering submission is missing or superseded'; end if;
 if p_outcome not in ('accepted','accepted_with_comments','changes_requested','rejected')
 then raise exception 'Select an explicit review decision'; end if;
 if p_outcome<>'accepted' and length(btrim(coalesce(p_comments,'')))<12
 then raise exception 'Please provide at least twelve characters of written review comments'; end if;
 if exists(select 1 from public.op_qa_client_review_decisions d where d.issue_id=v_issue.id)
 then raise exception 'This review already has a recorded decision'; end if;
 insert into public.op_qa_client_review_decisions(organisation_id,project_id,issue_id,decided_by,outcome,comments)
 values(v_project.organisation_id,p_project_id,v_issue.id,v_user,p_outcome,nullif(btrim(coalesce(p_comments,'')),''))
 returning id into v_id;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_project.organisation_id,'project',p_project_id,null,'client_review.client_attested',
 jsonb_build_object('decisionId',v_id,'issueId',v_issue.id,'executionCycle',v_cycle,'outcome',p_outcome,'externalAuthUserId',v_user));
 return jsonb_build_object('decisionId',v_id,'recorded',true,'pendingOpReconciliation',true,
   'projectStage',v_project.project_stage);
end $function$
;
