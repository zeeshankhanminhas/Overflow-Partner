-- Governed project delivery stages for Overflow Partner

alter table public.projects
  add column if not exists project_stage text not null default 'mobilisation';

alter table public.projects
  drop constraint if exists projects_project_stage_check;

alter table public.projects
  add constraint projects_project_stage_check check (
    project_stage in (
      'mobilisation',
      'ready_for_execution',
      'in_progress',
      'internal_review',
      'partner_correction',
      'ready_for_client_issue',
      'issued_to_client',
      'client_review',
      'completion',
      'closed'
    )
  );

create index if not exists projects_organisation_stage_idx
  on public.projects (organisation_id, project_stage);

create or replace function public.op_advance_project_stage(
  p_project_id uuid,
  p_target_stage text,
  p_actor_id uuid,
  p_note text default null
)
returns public.projects
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_project public.projects;
  v_allowed boolean := false;
  v_open_tasks integer := 0;
  v_any_tasks integer := 0;
  v_approved_documents integer := 0;
  v_issued_documents integer := 0;
  v_status text;
begin
  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if v_project.id is null then
    raise exception 'Project not found.';
  end if;

  if v_project.organisation_id is null then
    raise exception 'Project organisation is missing.';
  end if;

  v_allowed := case v_project.project_stage
    when 'mobilisation' then p_target_stage = 'ready_for_execution'
    when 'ready_for_execution' then p_target_stage = 'in_progress'
    when 'in_progress' then p_target_stage = 'internal_review'
    when 'internal_review' then p_target_stage in ('partner_correction', 'ready_for_client_issue')
    when 'partner_correction' then p_target_stage in ('in_progress', 'ready_for_client_issue')
    when 'ready_for_client_issue' then p_target_stage = 'issued_to_client'
    when 'issued_to_client' then p_target_stage = 'client_review'
    when 'client_review' then p_target_stage = 'completion'
    when 'completion' then p_target_stage = 'closed'
    else false
  end;

  if not v_allowed then
    raise exception 'Transition from % to % is not permitted.', v_project.project_stage, p_target_stage;
  end if;

  select count(*), count(*) filter (where status not in ('completed', 'cancelled'))
    into v_any_tasks, v_open_tasks
  from public.tasks
  where organisation_id = v_project.organisation_id
    and entity_type = 'project'
    and entity_id = v_project.id;

  select
    count(*) filter (where status in ('approved', 'issued')),
    count(*) filter (where status = 'issued')
    into v_approved_documents, v_issued_documents
  from public.documents
  where organisation_id = v_project.organisation_id
    and project_id = v_project.id;

  if p_target_stage = 'ready_for_execution' then
    if v_project.quote_id is null then
      raise exception 'An accepted quote must be linked before execution can be authorised.';
    end if;
    if v_project.start_date is null or v_project.due_date is null then
      raise exception 'Start and due dates must be recorded before execution can be authorised.';
    end if;
  end if;

  if p_target_stage = 'internal_review' then
    if v_any_tasks = 0 then
      raise exception 'At least one delivery activity must be recorded before internal review.';
    end if;
    if v_open_tasks > 0 then
      raise exception 'All delivery activities must be completed or cancelled before internal review.';
    end if;
  end if;

  if p_target_stage = 'ready_for_client_issue' and v_approved_documents = 0 then
    raise exception 'At least one approved controlled document is required before client issue.';
  end if;

  if p_target_stage in ('issued_to_client', 'client_review', 'completion', 'closed') and v_issued_documents = 0 then
    raise exception 'At least one issued controlled document is required for this stage.';
  end if;

  if p_target_stage = 'completion' and v_open_tasks > 0 then
    raise exception 'Open delivery activities must be resolved before project completion.';
  end if;

  v_status := case p_target_stage
    when 'mobilisation' then 'planning'
    when 'ready_for_execution' then 'planning'
    when 'in_progress' then 'active'
    when 'internal_review' then 'review'
    when 'partner_correction' then 'waiting'
    when 'ready_for_client_issue' then 'review'
    when 'issued_to_client' then 'waiting'
    when 'client_review' then 'waiting'
    when 'completion' then 'completed'
    when 'closed' then 'closed'
  end;

  update public.projects
  set project_stage = p_target_stage,
      status = v_status,
      notes = case
        when nullif(trim(coalesce(p_note, '')), '') is null then notes
        when notes is null or trim(notes) = '' then trim(p_note)
        else notes || E'\n\nStage note: ' || trim(p_note)
      end,
      updated_at = now()
  where id = v_project.id
  returning * into v_project;

  insert into public.activity_events (
    organisation_id,
    entity_type,
    entity_id,
    user_id,
    event_type,
    old_value,
    new_value,
    event_data
  ) values (
    v_project.organisation_id,
    'project',
    v_project.id,
    p_actor_id,
    'project.stage_advanced',
    jsonb_build_object('project_stage', case p_target_stage
      when 'ready_for_execution' then 'mobilisation'
      when 'in_progress' then 'ready_for_execution'
      when 'internal_review' then 'in_progress'
      when 'partner_correction' then 'internal_review'
      when 'ready_for_client_issue' then case when v_project.status = 'waiting' then 'partner_correction' else 'internal_review' end
      when 'issued_to_client' then 'ready_for_client_issue'
      when 'client_review' then 'issued_to_client'
      when 'completion' then 'client_review'
      when 'closed' then 'completion'
    end),
    jsonb_build_object('project_stage', p_target_stage, 'status', v_status),
    jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), ''))
  );

  return v_project;
end;
$$;

grant execute on function public.op_advance_project_stage(uuid, text, uuid, text) to authenticated;
