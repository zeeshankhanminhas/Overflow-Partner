begin;

-- Partner-executed projects use external commencement evidence to control
-- Ready for execution -> In progress. Internal projects retain the existing
-- activity-based readiness rule.
create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
  v_execution_assignment_id uuid;
  v_partner_commenced boolean := false;
begin
  select * into p from public.projects where id=p_project_id;
  if not found then return jsonb_build_object('ready',false,'reasons',jsonb_build_array('Project not found.')); end if;
  v_stage := coalesce(p.project_stage,'mobilisation');

  select count(*), count(*) filter (where status not in ('completed','cancelled'))
    into v_total,v_open
  from public.tasks
  where entity_type='project' and entity_id=p.id;

  select count(*) filter (where status::text in ('approved','issued','published')),
         count(*) filter (where status::text in ('issued','published'))
    into v_approved_docs,v_issued_docs
  from public.documents
  where project_id=p.id;

  select exists(
    select 1 from public.documents
    where project_id=p.id
      and lower(coalesce(title,'')) like '%scope%'
      and status::text in ('approved','issued','published')
  ) into v_scope_ready;

  select exists(
    select 1 from public.documents
    where project_id=p.id
      and document_type in ('completion-report','handover-pack')
      and status::text in ('issued','published')
  ) into v_completion_ready;

  select id into v_execution_assignment_id
  from public.project_execution_assignments
  where project_id=p.id
    and execution_state not in ('closed','cancelled')
  order by created_at desc
  limit 1;

  if v_execution_assignment_id is not null then
    select exists(
      select 1 from public.partner_commencement_declarations
      where assignment_id=v_execution_assignment_id
    ) into v_partner_commenced;
  end if;

  if v_stage='mobilisation' then
    if p.quote_id is null then v_reasons:=v_reasons||jsonb_build_array('Accepted quote is not linked.'); end if;
    if p.project_manager_id is null then v_reasons:=v_reasons||jsonb_build_array('Project manager is not assigned.'); end if;
    if p.start_date is null then v_reasons:=v_reasons||jsonb_build_array('Start date is not recorded.'); end if;
    if p.due_date is null then v_reasons:=v_reasons||jsonb_build_array('Due date is not recorded.'); end if;
    if not v_scope_ready then v_reasons:=v_reasons||jsonb_build_array('An approved Scope of Work is required.'); end if;
  elsif v_stage='ready_for_execution' then
    if not v_scope_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Scope of Work is required.'); end if;
    if v_execution_assignment_id is not null then
      if not v_partner_commenced then
        v_reasons:=v_reasons||jsonb_build_array('Execution Partner commencement declaration is required.');
      end if;
    elsif v_total=0 then
      v_reasons:=v_reasons||jsonb_build_array('At least one delivery activity is required.');
    end if;
  elsif v_stage='in_progress' then
    if v_execution_assignment_id is null then
      if v_total=0 then v_reasons:=v_reasons||jsonb_build_array('No delivery activities exist.'); end if;
      if v_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_open||' delivery activities remain open.'); end if;
    else
      if not exists(select 1 from public.partner_delivery_submissions where assignment_id=v_execution_assignment_id) then
        v_reasons:=v_reasons||jsonb_build_array('Execution Partner delivery submission is required before internal review.');
      end if;
    end if;
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
  return jsonb_build_object(
    'ready',v_ready,
    'stage',v_stage,
    'reasons',v_reasons,
    'activityTotal',v_total,
    'activityOpen',v_open,
    'approvedDocuments',v_approved_docs,
    'issuedDocuments',v_issued_docs,
    'executionMode',case when v_execution_assignment_id is null then 'internal' else 'partner' end,
    'partnerCommencement',v_partner_commenced
  );
end;
$$;

-- Atomic external commencement transaction. The service-role token API is the
-- only caller. A declaration and project-stage transition either both commit or
-- neither does.
create or replace function public.op_record_partner_commencement(
  p_assignment_id uuid,
  p_session_id uuid,
  p_execution_lead_name text,
  p_execution_lead_role text,
  p_planned_commencement_date date,
  p_forecast_delivery_date date,
  p_assumptions text,
  p_submitted_by_name text,
  p_submitted_by_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.project_execution_assignments;
  v_project public.projects;
  v_declaration_id uuid;
  v_submitted_at timestamptz;
begin
  select * into v_assignment
  from public.project_execution_assignments
  where id=p_assignment_id
  for update;

  if v_assignment.id is null then raise exception 'Execution assignment not found.'; end if;
  if v_assignment.execution_state in ('closed','cancelled') then raise exception 'Execution assignment is not active.'; end if;

  select * into v_project from public.projects where id=v_assignment.project_id for update;
  if v_project.id is null then raise exception 'Project not found.'; end if;
  if v_project.project_stage <> 'ready_for_execution' then
    raise exception 'Partner commencement can only start a Project that is Ready for execution.';
  end if;

  if exists(select 1 from public.partner_commencement_declarations where assignment_id=v_assignment.id) then
    raise exception 'A commencement declaration is already recorded for this execution assignment.';
  end if;

  insert into public.partner_commencement_declarations (
    organisation_id,assignment_id,project_id,partner_id,
    execution_lead_name,execution_lead_role,planned_commencement_date,forecast_delivery_date,
    scope_reviewed,inputs_received,capacity_confirmed,no_unresolved_blocker,
    assumptions,declaration_text,submitted_by_name,submitted_by_role
  ) values (
    v_assignment.organisation_id,v_assignment.id,v_assignment.project_id,v_assignment.partner_id,
    trim(p_execution_lead_name),nullif(trim(coalesce(p_execution_lead_role,'')),''),p_planned_commencement_date,p_forecast_delivery_date,
    true,true,true,true,
    nullif(trim(coalesce(p_assumptions,'')),''),
    'We confirm that we reviewed the controlled execution package, received the required inputs, have capacity to proceed, have no unresolved commencement blocker, and are commencing execution against the identified project scope.',
    trim(p_submitted_by_name),nullif(trim(coalesce(p_submitted_by_role,'')),'')
  ) returning id,submitted_at into v_declaration_id,v_submitted_at;

  update public.project_execution_assignments
  set execution_state='executing'
  where id=v_assignment.id;

  if p_session_id is not null then
    update public.partner_execution_sessions set status='active' where id=p_session_id and assignment_id=v_assignment.id;
  end if;

  perform public.op_advance_project_stage(v_assignment.project_id,'in_progress',null,'Execution Partner commencement declaration received.');

  insert into public.activity_events (
    organisation_id,entity_type,entity_id,user_id,event_type,event_data
  ) values (
    v_assignment.organisation_id,'project',v_assignment.project_id,null,'partner_execution.commencement_declared',
    jsonb_build_object(
      'assignmentId',v_assignment.id,
      'partnerId',v_assignment.partner_id,
      'declarationId',v_declaration_id,
      'submittedAt',v_submitted_at,
      'executionLeadName',trim(p_execution_lead_name),
      'forecastDeliveryDate',p_forecast_delivery_date,
      'source','execution_partner',
      'stageControl','ready_for_execution_to_in_progress'
    )
  );

  return jsonb_build_object('declarationId',v_declaration_id,'submittedAt',v_submitted_at,'projectStage','in_progress');
end;
$$;

revoke all on function public.op_record_partner_commencement(uuid,uuid,text,text,date,date,text,text,text) from public, anon, authenticated;
grant execute on function public.op_record_partner_commencement(uuid,uuid,text,text,date,date,text,text,text) to service_role;

commit;
