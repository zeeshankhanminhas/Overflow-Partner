-- QA protected client review: prohibit unsourced manual review approvals and classify correction rounds.
CREATE OR REPLACE FUNCTION public.op_record_client_review_outcome_core(p_organisation_id uuid, p_user_id uuid, p_project_id uuid, p_outcome text, p_evidence_basis text, p_evidence_reference text, p_comments text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_project public.projects;
  v_transmittal_id uuid;
  v_review public.project_client_reviews;
  v_cycle integer:=1;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_outcome not in ('accepted','accepted_with_comments','changes_requested','rejected') then raise exception 'Select a valid Client Review outcome.'; end if;
  if p_evidence_basis not in ('email_confirmation','signed_acceptance','client_portal','meeting_record','other_written') then raise exception 'Select a valid Client Review evidence basis.'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'Client Review evidence reference is required.'; end if;
  select * into v_project from public.projects where id=p_project_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Project not found.'; end if;
  if v_project.project_stage<>'client_review' then raise exception 'Client Review outcome can only be recorded during Client Review.'; end if;
  select coalesce(a.execution_cycle,1) into v_cycle from public.project_execution_assignments a
  where a.project_id=p_project_id and a.execution_state not in ('closed','cancelled') order by a.created_at desc limit 1;
  v_cycle:=coalesce(v_cycle,1);

  -- Protected QA client issues cannot be converted into a canonical client
  -- acceptance by an OP employee fabricating email/portal evidence.
  if exists(select 1 from public.op_qa_client_review_issues i
    where i.project_id=p_project_id and i.organisation_id=p_organisation_id
      and i.execution_cycle=v_cycle)
  then
    if current_setting('op.qa_client_review_reconciliation',true) is distinct from 'allowed'
    then raise exception 'Protected QA Client Review requires an attributable external portal attestation and controlled OP reconciliation'; end if;
    if p_evidence_basis<>'client_portal'
    or not exists(
      select 1 from public.op_qa_client_review_decisions d
      join public.op_qa_client_review_issues i on i.id=d.issue_id
      where i.project_id=p_project_id and i.organisation_id=p_organisation_id
        and i.execution_cycle=v_cycle and d.outcome=p_outcome
        and p_evidence_reference='QA-PORTAL/'||d.id::text)
    then raise exception 'The evidenced client outcome does not match the authenticated external decision'; end if;
  end if;

  select id into v_transmittal_id from public.project_client_transmittals
  where organisation_id=p_organisation_id and project_id=p_project_id and execution_cycle=v_cycle
  order by issued_at desc limit 1;
  if v_transmittal_id is null then raise exception 'Current-cycle client transmittal evidence is required before Client Review outcome.'; end if;
  if exists(select 1 from public.project_client_reviews where organisation_id=p_organisation_id and project_id=p_project_id and execution_cycle=v_cycle) then
    raise exception 'This execution cycle already has a recorded Client Review outcome.';
  end if;

  insert into public.project_client_reviews(organisation_id,project_id,transmittal_id,execution_cycle,outcome,evidence_basis,evidence_reference,comments,recorded_by)
  values(p_organisation_id,p_project_id,v_transmittal_id,v_cycle,p_outcome,p_evidence_basis,trim(p_evidence_reference),nullif(trim(coalesce(p_comments,'')),''),p_user_id)
  returning * into v_review;
  perform public.op_record_activity(p_organisation_id,p_user_id,'project',p_project_id,'client_review_outcome_recorded',
    jsonb_build_object('clientReviewId',v_review.id,'executionCycle',v_cycle,'outcome',p_outcome,'evidenceBasis',p_evidence_basis,'evidenceReference',trim(p_evidence_reference)));

  if p_outcome in ('changes_requested','rejected') then
    perform public.op_advance_project_stage(p_project_id,'partner_correction',p_user_id,'Client Review requires correction for execution cycle '||v_cycle||': '||trim(p_evidence_reference));
    return jsonb_build_object('review',to_jsonb(v_review),'projectStage','partner_correction');
  end if;
  return jsonb_build_object('review',to_jsonb(v_review),'projectStage','client_review');
end $function$
;

create or replace function public.op_qa_reconcile_classified_client_review(
 p_project_id uuid,p_classification text,p_rationale text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_org uuid;v_stage text;v_role text;
 v_issue public.op_qa_client_review_issues%rowtype;v_decision public.op_qa_client_review_decisions%rowtype;
 v_cycle int;v_result jsonb;v_prior int;
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
 if v_issue.id is null then raise exception 'No current-cycle protected client review exists'; end if;
 select * into v_decision from public.op_qa_client_review_decisions where issue_id=v_issue.id;
 if v_decision.id is null then raise exception 'The signed-in client has not submitted a decision'; end if;
 if exists(select 1 from public.project_client_reviews where project_id=p_project_id
 and organisation_id=v_org and execution_cycle=v_cycle)
 then raise exception 'The current-cycle review decision has already been reconciled'; end if;
 if v_decision.outcome in ('changes_requested','rejected') then
   if p_classification not in ('included_correction','partner_defect')
   then raise exception 'New/out-of-scope work requires a separately authorised commercial variation, not a free correction'; end if;
   if length(btrim(coalesce(p_rationale,'')))<20
   then raise exception 'Record the documented correction classification rationale (20+ characters)'; end if;
   if p_classification='included_correction' then
     select count(*) into v_prior from public.project_client_reviews r
       where r.project_id=p_project_id and r.organisation_id=v_org
       and r.execution_cycle<v_cycle and r.outcome in ('changes_requested','rejected');
     if v_prior>0 then
       raise exception 'One included client correction has already been used; new work requires variation authority';
     end if;
   end if;
 else
   if p_classification is distinct from 'none' then
     raise exception 'Accepted review must not be classified as a correction'; end if;
 end if;
 -- This transaction alone may use the pre-existing canonical OP recording and
 -- stage-advance code. The guard inside the core denies all other paths.
 perform set_config('op.qa_client_review_reconciliation','allowed',true);
 v_result:=public.op_record_client_review_outcome_core(
  v_org,v_user,p_project_id,v_decision.outcome,'client_portal',
  'QA-PORTAL/'||v_decision.id::text,v_decision.comments);
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'client_review.external_decision_reconciled',
  jsonb_build_object('externalDecisionId',v_decision.id,'outcome',v_decision.outcome,
  'classification',p_classification,'rationale',nullif(btrim(coalesce(p_rationale,'')),'')));
 return v_result || jsonb_build_object('reconciled',true,'externalDecisionId',v_decision.id);
end $fn$;
revoke all on function public.op_qa_reconcile_classified_client_review(uuid,text,text) from public,anon;
grant execute on function public.op_qa_reconcile_classified_client_review(uuid,text,text) to authenticated;
-- The superseded unclassified reconciliation RPC must not remain callable.
revoke execute on function public.op_qa_reconcile_client_review_decision(uuid) from public,anon,authenticated;
