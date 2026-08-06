begin;

alter table public.tasks add column if not exists activity_type text not null default 'delivery';
alter table public.tasks add column if not exists priority text not null default 'normal';
alter table public.tasks add column if not exists owner_id uuid;
alter table public.tasks add column if not exists notes text;
alter table public.tasks add column if not exists project_stage text;
alter table public.tasks add column if not exists linked_document_id uuid references public.documents(id) on delete set null;
alter table public.tasks add column if not exists completed_at timestamptz;
alter table public.tasks add column if not exists updated_at timestamptz not null default now();

create or replace function public.op_update_project_mobilisation(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_project_manager_id uuid,
  p_start_date date,
  p_due_date date
) returns public.projects
language plpgsql security definer set search_path = public
as $$
declare
  v_project public.projects;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);
  if p_start_date is null or p_due_date is null then raise exception 'Start date and due date are required.'; end if;
  if p_due_date < p_start_date then raise exception 'Due date cannot be before the start date.'; end if;
  if not exists (select 1 from public.profiles where id = p_project_manager_id and organisation_id = p_organisation_id) then
    raise exception 'Project manager must be an active member of this organisation.';
  end if;

  update public.projects
  set project_manager_id = p_project_manager_id,
      start_date = p_start_date,
      due_date = p_due_date,
      updated_at = now()
  where organisation_id = p_organisation_id and id = p_project_id
  returning * into v_project;
  if not found then raise exception 'Project not found.'; end if;

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',p_project_id,'project.mobilisation_updated',
    jsonb_build_object('projectManagerId',p_project_manager_id,'startDate',p_start_date,'dueDate',p_due_date));
  return v_project;
end;
$$;

create or replace function public.op_create_project_activity(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_title text,
  p_activity_type text,
  p_owner_id uuid,
  p_due_at timestamptz,
  p_priority text,
  p_notes text,
  p_project_stage text,
  p_linked_document_id uuid default null
) returns public.tasks
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.tasks;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'Activity title is required.'; end if;
  if p_owner_id is not null and not exists (select 1 from public.profiles where id=p_owner_id and organisation_id=p_organisation_id) then
    raise exception 'Activity owner must belong to this organisation.';
  end if;
  if not exists (select 1 from public.projects where id=p_project_id and organisation_id=p_organisation_id) then raise exception 'Project not found.'; end if;

  insert into public.tasks (organisation_id,entity_type,entity_id,title,status,due_at,activity_type,priority,owner_id,notes,project_stage,linked_document_id,created_by,updated_at)
  values (p_organisation_id,'project',p_project_id,trim(p_title),'open',p_due_at,coalesce(nullif(trim(p_activity_type),''),'delivery'),coalesce(nullif(trim(p_priority),''),'normal'),p_owner_id,nullif(trim(coalesce(p_notes,'')),''),p_project_stage,p_linked_document_id,p_user_id,now())
  returning * into v_task;

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',p_project_id,'project.activity_created',
    jsonb_build_object('taskId',v_task.id,'title',v_task.title,'activityType',v_task.activity_type,'stage',v_task.project_stage,'priority',v_task.priority));
  return v_task;
end;
$$;

create or replace function public.op_set_project_activity_status(
  p_organisation_id uuid,
  p_user_id uuid,
  p_task_id uuid,
  p_status text
) returns public.tasks
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.tasks;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_status not in ('open','in_progress','blocked','completed','cancelled') then raise exception 'Unsupported activity status.'; end if;
  select * into v_task from public.tasks where id=p_task_id and organisation_id=p_organisation_id and entity_type='project' for update;
  if not found then raise exception 'Project activity not found.'; end if;
  update public.tasks set status=p_status, completed_at=case when p_status='completed' then now() else null end, updated_at=now() where id=p_task_id returning * into v_task;
  perform public.op_record_activity(p_organisation_id,p_user_id,'project',v_task.entity_id,'project.activity_status_changed',
    jsonb_build_object('taskId',v_task.id,'title',v_task.title,'status',p_status));
  return v_task;
end;
$$;

create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  p public.projects;
  v_stage text;
  v_open integer;
  v_total integer;
  v_approved_docs integer;
  v_issued_docs integer;
  v_scope_ready boolean;
  v_completion_ready boolean;
  v_ready boolean := false;
  v_reasons jsonb := '[]'::jsonb;
begin
  select * into p from public.projects where id=p_project_id;
  if not found then return jsonb_build_object('ready',false,'reasons',jsonb_build_array('Project not found.')); end if;
  v_stage := coalesce(p.project_stage,'mobilisation');
  select count(*), count(*) filter (where status not in ('completed','cancelled')) into v_total,v_open from public.tasks where entity_type='project' and entity_id=p.id;
  select count(*) filter (where status::text in ('approved','issued','published')), count(*) filter (where status::text in ('issued','published'))
    into v_approved_docs,v_issued_docs from public.documents where project_id=p.id;
  select exists(select 1 from public.documents where project_id=p.id and lower(coalesce(title,'')) like '%scope%' and status::text in ('approved','issued','published')) into v_scope_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type in ('completion-report','handover-pack') and status::text in ('issued','published')) into v_completion_ready;

  if v_stage='mobilisation' then
    if p.quote_id is null then v_reasons:=v_reasons||jsonb_build_array('Accepted quote is not linked.'); end if;
    if p.project_manager_id is null then v_reasons:=v_reasons||jsonb_build_array('Project manager is not assigned.'); end if;
    if p.start_date is null then v_reasons:=v_reasons||jsonb_build_array('Start date is not recorded.'); end if;
    if p.due_date is null then v_reasons:=v_reasons||jsonb_build_array('Due date is not recorded.'); end if;
    if not v_scope_ready then v_reasons:=v_reasons||jsonb_build_array('An approved Scope of Work is required.'); end if;
  elsif v_stage='ready_for_execution' then
    if not v_scope_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Scope of Work is required.'); end if;
    if v_total=0 then v_reasons:=v_reasons||jsonb_build_array('At least one delivery activity is required.'); end if;
  elsif v_stage='in_progress' then
    if v_total=0 then v_reasons:=v_reasons||jsonb_build_array('No delivery activities exist.'); end if;
    if v_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_open||' delivery activities remain open.'); end if;
  elsif v_stage='internal_review' then
    if v_approved_docs=0 then v_reasons:=v_reasons||jsonb_build_array('At least one approved controlled deliverable is required.'); end if;
    if exists(select 1 from public.tasks where entity_type='project' and entity_id=p.id and status='blocked') then v_reasons:=v_reasons||jsonb_build_array('Blocked activities must be resolved.'); end if;
  elsif v_stage='partner_correction' then
    if exists(select 1 from public.tasks where entity_type='project' and entity_id=p.id and status not in ('completed','cancelled')) then v_reasons:=v_reasons||jsonb_build_array('Correction activities remain open.'); end if;
  elsif v_stage='ready_for_client_issue' then
    if v_issued_docs=0 then v_reasons:=v_reasons||jsonb_build_array('At least one controlled deliverable must be issued.'); end if;
  elsif v_stage='issued_to_client' then
    if v_issued_docs=0 then v_reasons:=v_reasons||jsonb_build_array('No issued client deliverable is recorded.'); end if;
  elsif v_stage='client_review' then
    if exists(select 1 from public.tasks where entity_type='project' and entity_id=p.id and status not in ('completed','cancelled')) then v_reasons:=v_reasons||jsonb_build_array('Client review activities remain open.'); end if;
  elsif v_stage='completion' then
    if not v_completion_ready then v_reasons:=v_reasons||jsonb_build_array('An issued completion or handover publication is required.'); end if;
    if v_open>0 then v_reasons:=v_reasons||jsonb_build_array('All activities must be resolved before closure.'); end if;
  end if;

  v_ready := jsonb_array_length(v_reasons)=0;
  return jsonb_build_object('ready',v_ready,'stage',v_stage,'reasons',v_reasons,'activityTotal',v_total,'activityOpen',v_open,'approvedDocuments',v_approved_docs,'issuedDocuments',v_issued_docs);
end;
$$;

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
  v_readiness jsonb;
  v_allowed text;
begin
  select * into v_project from public.projects where id=p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;
  perform public.op_assert_membership(v_project.organisation_id,p_actor_id);
  v_allowed := case coalesce(v_project.project_stage,'mobilisation')
    when 'mobilisation' then 'ready_for_execution'
    when 'ready_for_execution' then 'in_progress'
    when 'in_progress' then 'internal_review'
    when 'internal_review' then case when p_target_stage='partner_correction' then 'partner_correction' else 'ready_for_client_issue' end
    when 'partner_correction' then 'in_progress'
    when 'ready_for_client_issue' then 'issued_to_client'
    when 'issued_to_client' then 'client_review'
    when 'client_review' then 'completion'
    when 'completion' then 'closed'
    else null end;
  if v_allowed is null or p_target_stage<>v_allowed then raise exception 'Transition from % to % is not permitted.',v_project.project_stage,p_target_stage; end if;
  v_readiness:=public.op_project_stage_readiness(p_project_id);
  if not coalesce((v_readiness->>'ready')::boolean,false) then raise exception 'Stage gate is blocked: %', v_readiness->'reasons'; end if;
  update public.projects set project_stage=p_target_stage, updated_at=now(), status=case when p_target_stage='closed' then 'completed' else status end where id=p_project_id returning * into v_project;
  perform public.op_record_activity(v_project.organisation_id,p_actor_id,'project',p_project_id,'project.stage_advanced',jsonb_build_object('stage',p_target_stage,'note',nullif(trim(coalesce(p_note,'')),''),'readiness',v_readiness));
  return v_project;
end;
$$;

commit;
