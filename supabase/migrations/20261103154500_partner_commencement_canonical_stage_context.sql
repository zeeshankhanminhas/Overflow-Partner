-- Repair the secure Partner Portal -> Project 360 transition in the
-- existing isolated Northfield QA journey. The business-readiness core is
-- unchanged; the ordinary staff-authenticated read gate remains unchanged.
-- op_record_partner_commencement is already restricted to service_role.
-- No new workflow, data fixture, table privilege or partner permission.
CREATE OR REPLACE FUNCTION public.op_advance_project_stage(p_project_id uuid, p_target_stage text, p_actor_id uuid, p_note text DEFAULT NULL::text)
 RETURNS projects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_project public.projects;
  v_current_stage text;
  v_allowed boolean:=false;
  v_correction_route boolean:=false;
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
    when 'partner_correction' then p_target_stage='internal_review'
    when 'ready_for_client_issue' then p_target_stage='issued_to_client'
    when 'issued_to_client' then p_target_stage='client_review'
    when 'client_review' then p_target_stage in ('completion','partner_correction')
    when 'completion' then p_target_stage='closed'
    else false end;
  if not v_allowed then raise exception 'Transition from % to % is not permitted.',v_current_stage,p_target_stage; end if;

  v_correction_route:=v_current_stage in ('internal_review','client_review') and p_target_stage='partner_correction';
  if not v_correction_route then
    -- Partner commencement uses an already-verified, server-only execution
    -- session (op_record_partner_commencement is EXECUTE service_role only).
    -- That RPC inserts the declaration and marks the assignment executing
    -- BEFORE invoking this canonical stage transition. It has no OP user JWT.
    -- Do not weaken op_project_stage_readiness for ordinary workspace users.
    if p_actor_id is null
       and auth.uid() is null
       and v_current_stage='ready_for_execution'
       and p_target_stage='in_progress'
       and exists (
         select 1
         from public.partner_commencement_declarations d
         join public.project_execution_assignments a
           on a.id=d.assignment_id and a.project_id=d.project_id
           and a.organisation_id=v_project.organisation_id
         join public.partner_work_order_acceptances w
           on w.assignment_id=a.id and w.project_id=a.project_id
           and w.partner_id=a.partner_id and w.scope_document_id=a.scope_document_id
         where d.project_id=v_project.id
           and d.organisation_id=v_project.organisation_id
           and a.execution_state='executing'
       )
    then
      -- Same substantive gates as the staff readiness RPC, but without
      -- wrongly demanding an OP staff login from a signed Partner Portal.
      v_readiness:=public.op_project_stage_readiness_with_duplicate_scope_gate(v_project.id);
    else
      v_readiness:=public.op_project_stage_readiness(v_project.id);
    end if;
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
  where project_id=v_project.id and execution_state not in ('closed','cancelled')
  order by created_at desc limit 1 for update;

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
end $function$
