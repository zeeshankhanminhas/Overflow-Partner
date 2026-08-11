begin;

-- ------------------------------------------------------------------
-- Critical quote state must be backed by the corresponding evidence,
-- regardless of whether the caller used the intended application RPC.
-- ------------------------------------------------------------------
create or replace function public.op_enforce_quote_document_gate()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if new.status::text=old.status::text then return new; end if;

  if new.status::text='issued' then
    if not exists(
      select 1 from public.documents d
      where d.organisation_id=new.organisation_id and d.quote_id=new.id
        and d.document_type='client-quote' and d.status::text in ('approved','issued','published')
        and d.is_current_revision=true
    ) then raise exception 'OS_INTEGRITY: Approved canonical Client Quote document is required before commercial issue.'; end if;
    if not exists(
      select 1 from public.quote_issue_records i
      where i.organisation_id=new.organisation_id and i.quote_id=new.id and i.quote_revision=new.revision
    ) then raise exception 'OS_INTEGRITY: Quote Issue Record is required before a quotation can become Issued.'; end if;
  end if;

  if new.status::text='accepted' then
    if not exists(
      select 1 from public.documents d
      where d.organisation_id=new.organisation_id and d.quote_id=new.id
        and d.document_type='client-quote' and d.status::text in ('issued','published')
        and d.is_current_revision=true
    ) then raise exception 'OS_INTEGRITY: Issued canonical Client Quote document is required before acceptance.'; end if;
    if not exists(
      select 1 from public.quote_acceptance_records a
      where a.organisation_id=new.organisation_id and a.quote_id=new.id
    ) then raise exception 'OS_INTEGRITY: Written client acceptance evidence is required before a quotation can become Accepted.'; end if;
  end if;
  return new;
end $$;

-- ------------------------------------------------------------------
-- Project stage is write-locked. Only the canonical transition engine
-- sets the transaction-local flag accepted by this trigger.
-- ------------------------------------------------------------------
create or replace function public.op_integrity_guard_project_transition()
returns trigger
language plpgsql security definer set search_path=public
as $$
begin
  if coalesce(old.project_stage,'mobilisation')=coalesce(new.project_stage,'mobilisation') then return new; end if;
  if coalesce(current_setting('op.project_stage_transition',true),'')<>'allowed' then
    raise exception 'OS_INTEGRITY: Project stage can change only through the canonical governed transition engine.';
  end if;
  return new;
end $$;

-- The canonical readiness function already contains financial mobilisation
-- readiness. Remove the historical second transition gate so there is one
-- stage-exit authority.
drop trigger if exists trg_projects_financial_mobilisation_gate on public.projects;

create or replace function public.op_advance_project_stage(
  p_project_id uuid,
  p_target_stage text,
  p_actor_id uuid,
  p_note text default null
) returns public.projects
language plpgsql security definer set search_path=public
as $$
declare
  v_project public.projects;
  v_current_stage text;
  v_allowed boolean:=false;
  v_correction_route boolean:=false;
  v_correction_return boolean:=false;
  v_readiness jsonb;
  v_reason text;
  v_status public.project_status;
  v_assignment public.project_execution_assignments;
  v_ref text;
  v_actor_role text;
begin
  select * into v_project from public.projects where id=p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;

  if p_actor_id is not null then
    if auth.uid() is distinct from p_actor_id then raise exception 'Unauthorised Project transition actor.'; end if;
    select role::text into v_actor_role from public.profiles
    where id=p_actor_id and organisation_id=v_project.organisation_id and is_active=true;
    if v_actor_role is null or v_actor_role not in ('owner','admin','operator','engineering','commercial') then
      raise exception 'Your role is not authorised to change Project lifecycle stage.';
    end if;
  elsif auth.uid() is not null then
    raise exception 'Authenticated Project transitions require an attributable actor.';
  end if;

  v_current_stage:=coalesce(v_project.project_stage,'mobilisation');
  v_allowed:=case v_current_stage
    when 'mobilisation' then p_target_stage='ready_for_execution'
    when 'ready_for_execution' then p_target_stage='in_progress'
    when 'in_progress' then p_target_stage='internal_review'
    when 'internal_review' then p_target_stage in ('partner_correction','ready_for_client_issue')
    when 'partner_correction' then p_target_stage='in_progress'
    when 'ready_for_client_issue' then p_target_stage='issued_to_client'
    when 'issued_to_client' then p_target_stage='client_review'
    when 'client_review' then p_target_stage in ('completion','partner_correction')
    when 'completion' then p_target_stage='closed'
    else false end;
  if not v_allowed then raise exception 'Transition from % to % is not permitted.',v_current_stage,p_target_stage; end if;

  v_correction_route:=v_current_stage in ('internal_review','client_review') and p_target_stage='partner_correction';
  v_correction_return:=v_current_stage='partner_correction' and p_target_stage='in_progress';

  if not v_correction_route and not v_correction_return then
    v_readiness:=public.op_project_stage_readiness(v_project.id);
    if not coalesce((v_readiness->>'ready')::boolean,false) then
      select string_agg(value,'; ') into v_reason from jsonb_array_elements_text(v_readiness->'reasons') as r(value);
      raise exception 'Current project gate is blocked: %',coalesce(v_reason,'required governed evidence is incomplete.');
    end if;
  end if;

  if v_current_stage='client_review' and p_target_stage='partner_correction' then
    if not exists(
      select 1 from public.project_client_reviews r
      join public.project_execution_assignments a on a.project_id=r.project_id and a.execution_cycle=r.execution_cycle
      where r.project_id=v_project.id and r.outcome in ('changes_requested','rejected')
      order by r.recorded_at desc limit 1
    ) then raise exception 'Client Review correction requires a current-cycle changes-requested or rejected outcome.'; end if;
  end if;

  select * into v_assignment from public.project_execution_assignments
  where project_id=v_project.id and execution_state not in ('closed','cancelled') order by created_at desc limit 1 for update;

  if p_target_stage='internal_review' then
    if v_assignment.id is not null then
      update public.partner_delivery_submissions set review_status='under_review'
      where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='technical-review' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'technical-review',v_ref,'Technical Review','draft',1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='document-register' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'document-register',v_ref,'Document Register','draft',1);
    end if;
  end if;

  if p_target_stage='partner_correction' and v_assignment.id is not null then
    update public.partner_delivery_submissions set review_status='changes_requested'
    where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    update public.project_execution_assignments set execution_cycle=execution_cycle+1,execution_state='executing',updated_at=now() where id=v_assignment.id;
  end if;

  if p_target_stage='ready_for_client_issue' then
    if v_assignment.id is not null then
      update public.partner_delivery_submissions set review_status='accepted'
      where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='handover-pack' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'handover-pack',v_ref,'Handover Pack','draft',1);
    end if;
  end if;

  if p_target_stage='completion' and not exists(select 1 from public.documents where project_id=v_project.id and document_type='completion-report' and status::text<>'superseded') then
    v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
    insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
    values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'completion-report',v_ref,'Completion Report','draft',1);
  end if;

  if p_target_stage='closed' and v_assignment.id is not null then
    update public.project_execution_assignments set execution_state='closed',updated_at=now() where id=v_assignment.id;
  end if;

  v_status:=case p_target_stage
    when 'ready_for_execution' then 'planning'::public.project_status
    when 'in_progress' then 'active'::public.project_status
    when 'internal_review' then 'review'::public.project_status
    when 'partner_correction' then 'waiting'::public.project_status
    when 'ready_for_client_issue' then 'review'::public.project_status
    when 'issued_to_client' then 'waiting'::public.project_status
    when 'client_review' then 'waiting'::public.project_status
    when 'completion' then 'completed'::public.project_status
    when 'closed' then 'closed'::public.project_status end;

  perform set_config('op.project_stage_transition','allowed',true);
  update public.projects
  set project_stage=p_target_stage,status=v_status,
      notes=case when nullif(trim(coalesce(p_note,'')),'') is null then notes when notes is null or trim(notes)='' then trim(p_note) else notes||E'\n\nStage note: '||trim(p_note) end,
      updated_at=now()
  where id=v_project.id returning * into v_project;

  insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,old_value,new_value,event_data)
  values(v_project.organisation_id,'project',v_project.id,p_actor_id,'project.stage_advanced',
    jsonb_build_object('project_stage',v_current_stage),jsonb_build_object('project_stage',p_target_stage,'status',v_status::text),
    jsonb_build_object('note',nullif(trim(coalesce(p_note,'')),''),'canonicalLifecycle',true));
  return v_project;
end $$;

revoke all on function public.op_advance_project_stage(uuid,text,uuid,text) from public,anon;
grant execute on function public.op_advance_project_stage(uuid,text,uuid,text) to authenticated,service_role;

-- Current-cycle evidence is unique and cannot be silently substituted with an
-- earlier revision-cycle record.
create unique index if not exists ux_project_client_transmittal_cycle
  on public.project_client_transmittals(project_id,execution_cycle);
create unique index if not exists ux_project_client_review_cycle
  on public.project_client_reviews(project_id,execution_cycle);

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
    if v_transmittal_count=0 then
      v_reasons:=v_reasons||jsonb_build_array('Current-cycle client transmittal record is required.');
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

-- Partner-reported and client-evidence rows cannot be forged or rewritten by a
-- normal authenticated table mutation. Dedicated governed functions/service
-- APIs remain able to write them.
revoke insert,update,delete on public.quote_issue_records from authenticated;
revoke insert,update,delete on public.quote_acceptance_records from authenticated;
revoke insert,update,delete on public.project_client_transmittals from authenticated;
revoke insert,update,delete on public.project_client_reviews from authenticated;
revoke insert,update,delete on public.partner_commencement_declarations from authenticated;
revoke insert,update,delete on public.partner_progress_updates from authenticated;
revoke insert,update,delete on public.partner_execution_exceptions from authenticated;
revoke insert,update,delete on public.partner_delivery_submissions from authenticated;
revoke insert,update,delete on public.partner_delivery_submission_files from authenticated;

commit;
