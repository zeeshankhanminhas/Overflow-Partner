begin;

-- Anonymous callers are never workspace members.  Authenticated callers must
-- use their own identity; service-role/database-internal calls may supply an
-- attributable workspace actor explicitly.
create or replace function public.op_assert_membership(
  p_organisation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.role() = 'anon' then
    raise exception 'Authentication is required for this workspace action.';
  end if;

  if auth.role() = 'authenticated'
     and auth.uid() is distinct from p_user_id then
    raise exception 'Unauthorised workspace actor.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
      and organisation_id = p_organisation_id
      and is_active = true
  ) then
    raise exception 'User is not an active member of this organisation.';
  end if;
end;
$$;

-- G03/G05 Case-owned Partner Review actions.
alter function public.op_create_partner_review_request(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,boolean)
  rename to op_create_partner_review_request_core;
revoke all on function public.op_create_partner_review_request_core(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,boolean)
  from public,anon,authenticated;
grant execute on function public.op_create_partner_review_request_core(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,boolean)
  to service_role;

create function public.op_create_partner_review_request(
  p_organisation_id uuid,
  p_user_id uuid,
  p_lead_id uuid,
  p_technical_intake_id uuid,
  p_partner_id uuid,
  p_token_hash text,
  p_response_due_at timestamptz,
  p_expires_at timestamptz,
  p_review_instructions text,
  p_scope_summary text,
  p_show_client_identity boolean default false,
  p_show_commercial_identity boolean default false
)
returns public.partner_review_requests
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,p_user_id,
    array['owner','admin','operator','engineering','commercial','business_development']
  );
  return public.op_create_partner_review_request_core(
    p_organisation_id,p_user_id,p_lead_id,p_technical_intake_id,p_partner_id,
    p_token_hash,p_response_due_at,p_expires_at,p_review_instructions,
    p_scope_summary,p_show_client_identity,p_show_commercial_identity
  );
end;
$$;
revoke all on function public.op_create_partner_review_request(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,boolean) from public,anon;
grant execute on function public.op_create_partner_review_request(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean,boolean) to authenticated,service_role;

alter function public.op_decide_partner_review(uuid,uuid,uuid,uuid,text,text,text,text,text)
  rename to op_decide_partner_review_core;
revoke all on function public.op_decide_partner_review_core(uuid,uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.op_decide_partner_review_core(uuid,uuid,uuid,uuid,text,text,text,text,text)
  to service_role;

create function public.op_decide_partner_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_request_id uuid,
  p_response_id uuid,
  p_decision text,
  p_review_notes text default null,
  p_accepted_assumptions text default null,
  p_accepted_risks text default null,
  p_clarification_request text default null
)
returns public.partner_review_internal_decisions
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,p_user_id,
    array['owner','admin','operator','engineering','commercial','business_development']
  );
  return public.op_decide_partner_review_core(
    p_organisation_id,p_user_id,p_request_id,p_response_id,p_decision,
    p_review_notes,p_accepted_assumptions,p_accepted_risks,p_clarification_request
  );
end;
$$;
revoke all on function public.op_decide_partner_review(uuid,uuid,uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.op_decide_partner_review(uuid,uuid,uuid,uuid,text,text,text,text,text) to authenticated,service_role;

-- G03/G05 Acquisition-owned Partner Review actions. Role sets mirror the
-- existing server-action authority exactly.
alter function public.op_create_prospect_partner_review_request(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean)
  rename to op_create_prospect_partner_review_request_core;
revoke all on function public.op_create_prospect_partner_review_request_core(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean)
  from public,anon,authenticated;
grant execute on function public.op_create_prospect_partner_review_request_core(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean)
  to service_role;

create function public.op_create_prospect_partner_review_request(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid,
  p_intake_session_id uuid,
  p_partner_id uuid,
  p_token_hash text,
  p_response_due_at timestamptz,
  p_expires_at timestamptz,
  p_review_instructions text,
  p_scope_summary text,
  p_show_client_identity boolean default false
)
returns public.partner_review_requests
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,p_user_id,
    array['owner','admin','business_development','operator','engineering']
  );
  return public.op_create_prospect_partner_review_request_core(
    p_organisation_id,p_user_id,p_prospect_id,p_intake_session_id,p_partner_id,
    p_token_hash,p_response_due_at,p_expires_at,p_review_instructions,
    p_scope_summary,p_show_client_identity
  );
end;
$$;
revoke all on function public.op_create_prospect_partner_review_request(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean) from public,anon;
grant execute on function public.op_create_prospect_partner_review_request(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,boolean) to authenticated,service_role;

alter function public.op_decide_prospect_partner_review(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text)
  rename to op_decide_prospect_partner_review_core;
revoke all on function public.op_decide_prospect_partner_review_core(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.op_decide_prospect_partner_review_core(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text)
  to service_role;

create function public.op_decide_prospect_partner_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid,
  p_request_id uuid,
  p_response_id uuid,
  p_decision text,
  p_review_notes text default null,
  p_accepted_assumptions text default null,
  p_accepted_risks text default null,
  p_clarification_request text default null
)
returns public.partner_review_internal_decisions
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,p_user_id,
    array['owner','admin','commercial','engineering']
  );
  return public.op_decide_prospect_partner_review_core(
    p_organisation_id,p_user_id,p_prospect_id,p_request_id,p_response_id,
    p_decision,p_review_notes,p_accepted_assumptions,p_accepted_risks,
    p_clarification_request
  );
end;
$$;
revoke all on function public.op_decide_prospect_partner_review(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) from public,anon;
grant execute on function public.op_decide_prospect_partner_review(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text) to authenticated,service_role;

-- Project mobilisation and internal delivery activities are Project 360 work,
-- not general member capabilities.
alter function public.op_update_project_mobilisation(uuid,uuid,uuid,uuid,date,date)
  rename to op_update_project_mobilisation_core;
revoke all on function public.op_update_project_mobilisation_core(uuid,uuid,uuid,uuid,date,date)
  from public,anon,authenticated;
grant execute on function public.op_update_project_mobilisation_core(uuid,uuid,uuid,uuid,date,date)
  to service_role;

create function public.op_update_project_mobilisation(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_project_manager_id uuid,
  p_start_date date,
  p_due_date date
)
returns public.projects
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,p_user_id,array['owner','admin','operator']
  );
  return public.op_update_project_mobilisation_core(
    p_organisation_id,p_user_id,p_project_id,p_project_manager_id,p_start_date,p_due_date
  );
end;
$$;
revoke all on function public.op_update_project_mobilisation(uuid,uuid,uuid,uuid,date,date) from public,anon;
grant execute on function public.op_update_project_mobilisation(uuid,uuid,uuid,uuid,date,date) to authenticated,service_role;

alter function public.op_create_project_activity(uuid,uuid,uuid,text,text,uuid,timestamptz,text,text,text,uuid)
  rename to op_create_project_activity_core;
revoke all on function public.op_create_project_activity_core(uuid,uuid,uuid,text,text,uuid,timestamptz,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.op_create_project_activity_core(uuid,uuid,uuid,text,text,uuid,timestamptz,text,text,text,uuid)
  to service_role;

create function public.op_create_project_activity(
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
)
returns public.tasks
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,p_user_id,array['owner','admin','operator','engineering','commercial']
  );
  return public.op_create_project_activity_core(
    p_organisation_id,p_user_id,p_project_id,p_title,p_activity_type,p_owner_id,
    p_due_at,p_priority,p_notes,p_project_stage,p_linked_document_id
  );
end;
$$;
revoke all on function public.op_create_project_activity(uuid,uuid,uuid,text,text,uuid,timestamptz,text,text,text,uuid) from public,anon;
grant execute on function public.op_create_project_activity(uuid,uuid,uuid,text,text,uuid,timestamptz,text,text,text,uuid) to authenticated,service_role;

alter function public.op_set_project_activity_status(uuid,uuid,uuid,text)
  rename to op_set_project_activity_status_core;
revoke all on function public.op_set_project_activity_status_core(uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.op_set_project_activity_status_core(uuid,uuid,uuid,text)
  to service_role;

create function public.op_set_project_activity_status(
  p_organisation_id uuid,
  p_user_id uuid,
  p_task_id uuid,
  p_status text
)
returns public.tasks
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,p_user_id,array['owner','admin','operator','engineering','commercial']
  );
  return public.op_set_project_activity_status_core(
    p_organisation_id,p_user_id,p_task_id,p_status
  );
end;
$$;
revoke all on function public.op_set_project_activity_status(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.op_set_project_activity_status(uuid,uuid,uuid,text) to authenticated,service_role;

-- Generic activity logging still supports authenticated server actions, but
-- anonymous callers cannot use it as a SECURITY DEFINER write endpoint.
revoke all on function public.op_record_activity(uuid,uuid,text,uuid,text,jsonb)
  from public,anon;
grant execute on function public.op_record_activity(uuid,uuid,text,uuid,text,jsonb)
  to authenticated,service_role;

commit;
