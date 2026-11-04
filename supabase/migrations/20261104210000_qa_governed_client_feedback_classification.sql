-- OPOS-QA client review feedback resolution: classify actual authenticated client feedback
-- before the existing project stage machine can return work to the partner.
-- This classification is a project governance decision, not a new authentication flow.
create table if not exists public.op_qa_client_correction_classifications(
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id),
 project_id uuid not null references public.projects(id),
 issue_id uuid not null unique references public.op_qa_client_review_issues(id),
 decision_id uuid not null unique references public.op_qa_client_review_decisions(id),
 execution_cycle integer not null check(execution_cycle>0),
 classification text not null check(classification in ('included_correction','partner_defect','variation')),
 rationale text not null check(char_length(btrim(rationale))>=25),
 partner_instruction text,
 change_request_id uuid unique references public.project_change_requests(id),
 classified_by uuid not null references public.profiles(id),
 classified_at timestamptz not null default now(),
 constraint op_qa_correction_partner_instruction_check check (
   (classification in ('included_correction','partner_defect') and
      partner_instruction is not null and char_length(btrim(partner_instruction))>=25)
    or (classification='variation' and partner_instruction is null)
 )
);
create index if not exists op_qa_client_correction_by_project
 on public.op_qa_client_correction_classifications(project_id,execution_cycle);
alter table public.op_qa_client_correction_classifications enable row level security;
revoke all on public.op_qa_client_correction_classifications from public,anon,authenticated;
grant all on public.op_qa_client_correction_classifications to service_role;

create or replace function public.op_qa_classify_and_resolve_client_feedback(
 p_project_id uuid,p_classification text,p_rationale text,p_partner_instruction text
) returns jsonb
 language plpgsql security definer set search_path=public,pg_temp as $fn$
declare
 v_user uuid:=auth.uid();v_project public.projects%rowtype;v_role text;
 v_issue public.op_qa_client_review_issues%rowtype;
 v_decision public.op_qa_client_review_decisions%rowtype;
 v_cycle integer;v_class_id uuid;v_change_id uuid;v_result jsonb;v_used integer;
begin
 select * into v_project from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles
  where id=v_user and organisation_id=v_project.organisation_id and is_active=true;
 if v_user is null or v_project.id is null or v_role not in ('owner','admin')
    or v_project.project_stage<>'client_review'
 then raise exception 'Authorised OP owner in current Client Review is required';end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
  where a.project_id=p_project_id and a.organisation_id=v_project.organisation_id
    and a.execution_state not in ('closed','cancelled') order by a.created_at desc limit 1;
 if v_cycle is null then raise exception 'Current active Execution Partner assignment is required';end if;
 select * into v_issue from public.op_qa_client_review_issues i
  where i.project_id=p_project_id and i.organisation_id=v_project.organisation_id
    and i.execution_cycle=v_cycle for update;
 if v_issue.id is null then raise exception 'Current cycle has no authenticated protected client review issue';end if;
 select * into v_decision from public.op_qa_client_review_decisions d
  where d.issue_id=v_issue.id for update;
 if v_decision.id is null or v_decision.outcome not in ('changes_requested','rejected')
 then raise exception 'Only an actual externally attested correction or rejection can be classified';end if;
 if exists(select 1 from public.project_client_reviews r where r.project_id=p_project_id
   and r.organisation_id=v_project.organisation_id and r.execution_cycle=v_cycle)
 then raise exception 'This client decision has already been reconciled';end if;
 if exists(select 1 from public.op_qa_client_correction_classifications c
    where c.issue_id=v_issue.id or c.decision_id=v_decision.id)
 then raise exception 'Client feedback was already classified; do not duplicate work or variation';end if;
 if p_classification not in ('included_correction','partner_defect','variation')
 then raise exception 'Choose included correction, partner defect, or commercial variation';end if;
 if length(btrim(coalesce(p_rationale,'')))<25
 then raise exception 'A written scope classification rationale of at least 25 characters is required';end if;
 if p_classification in ('included_correction','partner_defect')
   and length(btrim(coalesce(p_partner_instruction,'')))<25
 then raise exception 'The Execution Partner must receive a clear written corrective instruction';end if;
 if p_classification='included_correction' then
   select count(*) into v_used from public.op_qa_client_correction_classifications
   where project_id=p_project_id and organisation_id=v_project.organisation_id
   and classification='included_correction';
   if v_used>=1 then raise exception 'The single included correction is already used. Evaluate a partner defect or authorised commercial variation.';end if;
 end if;
 insert into public.op_qa_client_correction_classifications(
  organisation_id,project_id,issue_id,decision_id,execution_cycle,classification,
  rationale,partner_instruction,classified_by
 ) values(
  v_project.organisation_id,p_project_id,v_issue.id,v_decision.id,v_cycle,p_classification,
  btrim(p_rationale),
  case when p_classification='variation' then null else btrim(p_partner_instruction) end,
  v_user
 ) returning id into v_class_id;
 if p_classification='variation' then
   -- This is a *proposal*, not a priced or accepted change order. Do not
   -- dispatch it to the partner or silently amend dates, margin or payment.
   insert into public.project_change_requests(
    organisation_id,project_id,change_reference,description,reason,scope_impact,
    programme_impact,commercial_impact,currency,status,requested_by
   ) values(
    v_project.organisation_id,p_project_id,
    'QA-VAR-'||replace(v_class_id::text,'-',''),
    coalesce(nullif(btrim(v_decision.comments),''),'Client requested new scope during controlled review'),
    btrim(p_rationale),'New scope / variation proposed; not included in approved Work Order',
    'No programme change approved',null,'GBP','proposed',v_user
   ) returning id into v_change_id;
   update public.op_qa_client_correction_classifications
    set change_request_id=v_change_id where id=v_class_id;
   insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
    values(v_project.organisation_id,'project',p_project_id,v_user,'client_review.variation_proposed',
    jsonb_build_object('clientDecisionId',v_decision.id,'classificationId',v_class_id,
      'changeRequestId',v_change_id,'cycle',v_cycle,'partnerInstructed',false));
   return jsonb_build_object('classification',p_classification,'classificationId',v_class_id,
      'changeRequestId',v_change_id,'projectStage','client_review',
      'partnerInstructed',false,'variationApprovalRequired',true);
 end if;
 -- The existing canonical client outcome recorder alone creates the governed
 -- client review record, changes the partner submission's status and opens a
 -- fresh execution cycle. Inserting this same-cycle classification is the
 -- additional evidence it requires; the transaction is all-or-nothing.
 v_result:=public.op_record_client_review_outcome_core(
  v_project.organisation_id,v_user,p_project_id,v_decision.outcome,
  'client_portal','QA-PORTAL/'||v_decision.id::text,v_decision.comments
 );
 if v_result->>'projectStage'<>'partner_correction'
 then raise exception 'Governed correction was not opened; classification rolled back';end if;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_project.organisation_id,'project',p_project_id,v_user,'client_review.partner_correction_classified',
  jsonb_build_object('clientDecisionId',v_decision.id,'classificationId',v_class_id,
    'executionCycleFrom',v_cycle,'classification',p_classification,'instructionPrepared',true));
 return jsonb_build_object('classification',p_classification,'classificationId',v_class_id,
   'projectStage','partner_correction','newExecutionCycle',v_cycle+1,
   'partnerInstructionRecorded',true);
end $fn$;

revoke all on function public.op_qa_classify_and_resolve_client_feedback(uuid,text,text,text)
 from public,anon;
grant execute on function public.op_qa_classify_and_resolve_client_feedback(uuid,text,text,text)
 to authenticated;

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
    if p_outcome in ('changes_requested','rejected')
       and not exists(
         select 1 from public.op_qa_client_correction_classifications c
         join public.op_qa_client_review_decisions d on d.id=c.decision_id
         join public.op_qa_client_review_issues i on i.id=d.issue_id
         where c.project_id=p_project_id and c.organisation_id=p_organisation_id
           and c.execution_cycle=v_cycle and i.execution_cycle=v_cycle
           and c.classification in ('included_correction','partner_defect')
           and d.outcome=p_outcome
           and p_evidence_reference='QA-PORTAL/'||d.id::text
       )
    then raise exception 'Protected client correction requires an actual externally attested outcome and authorised included-correction or partner-defect classification'; end if;
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
