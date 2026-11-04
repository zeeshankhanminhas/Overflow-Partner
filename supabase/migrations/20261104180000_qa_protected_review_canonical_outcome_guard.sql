-- Isolated QA security hardening: no false manual acceptance for protected client issues.
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

  -- Protected client review submissions may be reconciled only from the actual
  -- current-cycle, authenticated client decision; an OP operator cannot create
  -- a second acceptance by presenting an invented email or portal reference.
  if exists(select 1 from public.op_qa_client_review_issues i
    where i.organisation_id=p_organisation_id and i.project_id=p_project_id
      and i.execution_cycle=v_cycle)
  then
    if p_outcome in ('changes_requested','rejected') then
      raise exception 'Protected client correction requires explicit scope classification and variation gating; automatic partner rework is not authorised';
    end if;
    if p_evidence_basis<>'client_portal' or not exists(
      select 1 from public.op_qa_client_review_decisions d
      join public.op_qa_client_review_issues i on i.id=d.issue_id
      where i.organisation_id=p_organisation_id and i.project_id=p_project_id
        and i.execution_cycle=v_cycle and d.outcome=p_outcome
        and p_evidence_reference='QA-PORTAL/'||d.id::text
    ) then
      raise exception 'Current protected review requires an actual authenticated client decision matching this exact recorded outcome';
    end if;
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
