begin;

create or replace function public.op_list_notification_delivery(
  p_status text default null,
  p_category text default null,
  p_limit integer default 150
)
returns table(
  id uuid,
  event_key text,
  category text,
  recipient_email text,
  recipient_name text,
  subject text,
  entity_type text,
  entity_id uuid,
  status text,
  scheduled_for timestamptz,
  attempts integer,
  max_attempts integer,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_organisation_id uuid;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Authentication is required for notification delivery.';
  end if;

  select p.organisation_id into v_organisation_id
  from public.profiles p
  where p.id=auth.uid() and p.is_active=true;

  if v_organisation_id is null then
    raise exception 'Active workspace membership is required.';
  end if;

  return query
  select
    n.id,n.event_key,n.category,n.recipient_email,n.recipient_name,n.subject,
    n.entity_type,n.entity_id,n.status,n.scheduled_for,n.attempts,n.max_attempts,
    n.last_error,n.sent_at,n.created_at
  from public.notification_outbox n
  where n.organisation_id=v_organisation_id
    and (p_status is null or n.status=p_status)
    and (p_category is null or n.category=p_category)
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit,150),1),150);
end;
$$;

revoke all on function public.op_list_notification_delivery(text,text,integer)
  from public,anon;
grant execute on function public.op_list_notification_delivery(text,text,integer)
  to authenticated;

commit;
