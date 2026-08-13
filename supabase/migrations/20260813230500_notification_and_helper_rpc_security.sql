begin;

-- Guard SECURITY DEFINER functions that do not carry an explicit p_user_id.
-- Authenticated callers must belong to the supplied organisation and hold one
-- of the roles allowed by the owning server action. Service-role workers remain
-- available for controlled backend processing.
create or replace function public.op_assert_current_workspace_role(
  p_organisation_id uuid,
  p_allowed_roles text[]
)
returns void
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_role text;
begin
  if auth.role() = 'anon' then
    raise exception 'Authentication is required for this workspace action.';
  end if;

  if auth.role() = 'authenticated' then
    select role::text into v_role
    from public.profiles
    where id=auth.uid()
      and organisation_id=p_organisation_id
      and is_active=true;

    if v_role is null or not (v_role = any(p_allowed_roles)) then
      raise exception 'Your role is not authorised to perform this workspace action.';
    end if;
  end if;
end;
$$;
revoke all on function public.op_assert_current_workspace_role(uuid,text[])
  from public,anon,authenticated;
grant execute on function public.op_assert_current_workspace_role(uuid,text[])
  to service_role;

-- Notification enqueue is a workspace action; it may not target an arbitrary
-- organisation from an anonymous or unrelated authenticated session.
alter function public.op_enqueue_notification(uuid,text,text,text,text,text,jsonb,text,uuid,text,timestamptz,text)
  rename to op_enqueue_notification_core;
revoke all on function public.op_enqueue_notification_core(uuid,text,text,text,text,text,jsonb,text,uuid,text,timestamptz,text)
  from public,anon,authenticated;
grant execute on function public.op_enqueue_notification_core(uuid,text,text,text,text,text,jsonb,text,uuid,text,timestamptz,text)
  to service_role;

create function public.op_enqueue_notification(
  p_organisation_id uuid,
  p_event_key text,
  p_recipient_email text,
  p_recipient_name text,
  p_subject text,
  p_template_key text,
  p_payload jsonb default '{}'::jsonb,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_category text default 'transactional',
  p_scheduled_for timestamptz default now(),
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_current_workspace_role(
    p_organisation_id,
    array['owner','admin','operator','engineering','commercial','business_development']
  );
  return public.op_enqueue_notification_core(
    p_organisation_id,p_event_key,p_recipient_email,p_recipient_name,p_subject,
    p_template_key,p_payload,p_entity_type,p_entity_id,p_category,p_scheduled_for,
    p_idempotency_key
  );
end;
$$;
revoke all on function public.op_enqueue_notification(uuid,text,text,text,text,text,jsonb,text,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.op_enqueue_notification(uuid,text,text,text,text,text,jsonb,text,uuid,text,timestamptz,text) to authenticated,service_role;

alter function public.op_cancel_notifications_for_entity(uuid,text,uuid,text[])
  rename to op_cancel_notifications_for_entity_core;
revoke all on function public.op_cancel_notifications_for_entity_core(uuid,text,uuid,text[])
  from public,anon,authenticated;
grant execute on function public.op_cancel_notifications_for_entity_core(uuid,text,uuid,text[])
  to service_role;

create function public.op_cancel_notifications_for_entity(
  p_organisation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_categories text[] default array['reminder','nurture']::text[]
)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_current_workspace_role(
    p_organisation_id,
    array['owner','admin','operator','engineering','commercial','business_development']
  );
  return public.op_cancel_notifications_for_entity_core(
    p_organisation_id,p_entity_type,p_entity_id,p_categories
  );
end;
$$;
revoke all on function public.op_cancel_notifications_for_entity(uuid,text,uuid,text[]) from public,anon;
grant execute on function public.op_cancel_notifications_for_entity(uuid,text,uuid,text[]) to authenticated,service_role;

alter function public.op_schedule_lead_nurture(uuid,uuid,text,text,text,text)
  rename to op_schedule_lead_nurture_core;
revoke all on function public.op_schedule_lead_nurture_core(uuid,uuid,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.op_schedule_lead_nurture_core(uuid,uuid,text,text,text,text)
  to service_role;

create function public.op_schedule_lead_nurture(
  p_organisation_id uuid,
  p_lead_id uuid,
  p_email text,
  p_name text,
  p_company text,
  p_action_url text
)
returns integer
language plpgsql
security definer
set search_path='public'
as $$
begin
  perform public.op_assert_current_workspace_role(
    p_organisation_id,
    array['owner','admin','operator','business_development']
  );
  return public.op_schedule_lead_nurture_core(
    p_organisation_id,p_lead_id,p_email,p_name,p_company,p_action_url
  );
end;
$$;
revoke all on function public.op_schedule_lead_nurture(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.op_schedule_lead_nurture(uuid,uuid,text,text,text,text) to authenticated,service_role;

-- The notification processor route uses SUPABASE_SERVICE_ROLE_KEY. These are
-- worker primitives, not user-facing RPCs.
revoke all on function public.op_claim_notification_batch(integer)
  from public,anon,authenticated;
grant execute on function public.op_claim_notification_batch(integer)
  to service_role;

revoke all on function public.op_complete_notification(uuid,text)
  from public,anon,authenticated;
grant execute on function public.op_complete_notification(uuid,text)
  to service_role;

revoke all on function public.op_fail_notification(uuid,text)
  from public,anon,authenticated;
grant execute on function public.op_fail_notification(uuid,text)
  to service_role;

-- Developer cleanup is authenticated and self-authorising via auth.uid() plus
-- developer_delete_enabled. Anonymous callers do not need an RPC surface.
revoke all on function public.op_can_delete_test_data() from public,anon;
grant execute on function public.op_can_delete_test_data() to authenticated,service_role;
revoke all on function public.op_delete_test_record(text,uuid) from public,anon;
grant execute on function public.op_delete_test_record(text,uuid) to authenticated,service_role;

-- Reference generation and controlled-quote evidence helpers are internal
-- implementation primitives used by governed SECURITY DEFINER functions.
revoke all on function public.op_next_reference(uuid,text,integer)
  from public,anon,authenticated;
grant execute on function public.op_next_reference(uuid,text,integer)
  to service_role;

revoke all on function public.op_has_controlled_quote_document(uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.op_has_controlled_quote_document(uuid,uuid,uuid,text)
  to service_role;

-- current_organisation_id() is deliberately retained for authenticated RLS
-- policies; anonymous callers have no organisation context.
revoke all on function public.current_organisation_id() from public,anon;
grant execute on function public.current_organisation_id() to authenticated,service_role;

commit;
