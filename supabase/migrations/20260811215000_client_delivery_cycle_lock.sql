begin;

alter table public.project_client_transmittals add column if not exists execution_cycle integer not null default 1 check(execution_cycle>0);
alter table public.project_client_reviews add column if not exists execution_cycle integer not null default 1 check(execution_cycle>0);
create index if not exists project_client_transmittals_cycle_idx on public.project_client_transmittals(project_id,execution_cycle,issued_at desc);
create index if not exists project_client_reviews_cycle_idx on public.project_client_reviews(project_id,execution_cycle,recorded_at desc);

create or replace function public.op_record_client_transmittal_and_issue(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_recipient_name text,
  p_recipient_email text,
  p_delivery_method text,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_project public.projects;
  v_ref text;
  v_manifest jsonb;
  v_transmittal public.project_client_transmittals;
  v_cycle integer:=1;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_delivery_method not in ('email','secure_link','client_portal','other') then raise exception 'Select a valid client delivery method.'; end if;
  if nullif(trim(coalesce(p_recipient_name,'')),'') is null then raise exception 'Client recipient name is required.'; end if;
  select * into v_project from public.projects where id=p_project_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Project not found.'; end if;
  if v_project.project_stage<>'ready_for_client_issue' then raise exception 'Client transmittal can only be recorded at Ready for client issue.'; end if;
  select coalesce(a.execution_cycle,1) into v_cycle from public.project_execution_assignments a
  where a.project_id=p_project_id and a.execution_state not in ('closed','cancelled') order by a.created_at desc limit 1;
  v_cycle:=coalesce(v_cycle,1);

  if exists(select 1 from public.project_client_transmittals where organisation_id=p_organisation_id and project_id=p_project_id and execution_cycle=v_cycle) then
    raise exception 'This execution cycle already has a controlled client transmittal.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('documentId',id,'reference',reference,'title',title,'revision',revision_code,'status',status::text) order by reference),'[]'::jsonb)
  into v_manifest from public.documents
  where organisation_id=p_organisation_id and project_id=p_project_id and status::text in ('issued','published') and is_current_revision=true;
  if jsonb_array_length(v_manifest)=0 then raise exception 'At least one issued controlled document is required for client transmittal.'; end if;

  v_ref:='OP-TX-'||v_project.project_number||'-C'||lpad(v_cycle::text,2,'0')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.project_client_transmittals(
    organisation_id,project_id,execution_cycle,transmittal_reference,recipient_name,recipient_email,delivery_method,document_manifest,note,issued_by
  ) values(
    p_organisation_id,p_project_id,v_cycle,v_ref,trim(p_recipient_name),nullif(trim(coalesce(p_recipient_email,'')),''),p_delivery_method,v_manifest,nullif(trim(coalesce(p_note,'')),''),p_user_id
  ) returning * into v_transmittal;

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',p_project_id,'client_transmittal_recorded',
    jsonb_build_object('transmittalId',v_transmittal.id,'reference',v_ref,'executionCycle',v_cycle,'recipientName',trim(p_recipient_name),'deliveryMethod',p_delivery_method,'documentManifest',v_manifest));
  perform public.op_advance_project_stage(p_project_id,'issued_to_client',p_user_id,'Controlled client transmittal '||v_ref||' recorded for execution cycle '||v_cycle||'.');
  return jsonb_build_object('transmittal',to_jsonb(v_transmittal),'projectStage','issued_to_client');
end $$;

create or replace function public.op_record_client_review_outcome(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_outcome text,
  p_evidence_basis text,
  p_evidence_reference text,
  p_comments text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
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
end $$;

-- Replace the public readiness wrapper with a cycle-aware wrapper. The core
-- remains the canonical lifecycle calculation created by the main lock
-- migration; this layer makes physical Partner files and client evidence
-- belong to the same current execution cycle.
create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  v_core jsonb;
  v_stage text;
  v_mode text;
  v_assignment_id uuid;
  v_cycle integer:=1;
  v_submission_id uuid;
  v_file_count integer:=0;
  v_transmittal_count integer:=0;
  v_client_outcome text;
  v_reasons jsonb;
begin
  v_core:=public.op_project_stage_readiness_core(p_project_id);
  v_stage:=coalesce(v_core->>'stage','');
  v_mode:=coalesce(v_core->>'executionMode','internal');
  v_reasons:=coalesce(v_core->'reasons','[]'::jsonb);

  select a.id,a.execution_cycle into v_assignment_id,v_cycle
  from public.project_execution_assignments a
  where a.project_id=p_project_id and a.execution_state not in ('closed','cancelled')
  order by a.created_at desc limit 1;
  v_cycle:=coalesce(v_cycle,1);

  if v_mode='partner' and v_stage in ('in_progress','internal_review') and v_assignment_id is not null then
    select d.id into v_submission_id from public.partner_delivery_submissions d
    where d.assignment_id=v_assignment_id and d.execution_cycle=v_cycle order by d.submitted_at desc limit 1;
    if v_submission_id is not null then
      select count(*) into v_file_count from public.partner_delivery_submission_files f
      where f.submission_id=v_submission_id and f.assignment_id=v_assignment_id and f.execution_cycle=v_cycle;
      if v_file_count=0 then v_reasons:=v_reasons||jsonb_build_array('Current-cycle Partner delivery must include at least one engineering output file.'); end if;
    end if;
  end if;

  if v_stage in ('ready_for_client_issue','issued_to_client','client_review','completion') then
    select count(*) into v_transmittal_count from public.project_client_transmittals
    where project_id=p_project_id and execution_cycle=v_cycle;
    if v_stage in ('issued_to_client','client_review','completion') and v_transmittal_count=0 then
      v_reasons:=v_reasons||jsonb_build_array('Current execution cycle has no controlled client transmittal.');
    end if;
  end if;

  if v_stage in ('client_review','completion') then
    select outcome into v_client_outcome from public.project_client_reviews
    where project_id=p_project_id and execution_cycle=v_cycle order by recorded_at desc limit 1;
    if v_client_outcome is null then
      v_reasons:=v_reasons||jsonb_build_array('Current execution cycle has no Client Review outcome.');
    elsif v_client_outcome not in ('accepted','accepted_with_comments') then
      v_reasons:=v_reasons||jsonb_build_array('Current execution cycle requires correction before completion.');
    end if;
  end if;

  return v_core || jsonb_build_object(
    'reasons',v_reasons,'ready',jsonb_array_length(v_reasons)=0,
    'executionCycle',v_cycle,'partnerDeliveryFileCount',v_file_count,
    'currentCycleClientTransmittals',v_transmittal_count,'currentCycleClientOutcome',v_client_outcome
  );
end $$;

commit;
