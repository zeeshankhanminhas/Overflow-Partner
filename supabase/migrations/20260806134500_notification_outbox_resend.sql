begin;

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  event_key text not null,
  channel text not null default 'email' check (channel in ('email','in_app')),
  category text not null default 'transactional' check (category in ('transactional','reminder','nurture','system')),
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  entity_type text,
  entity_id uuid,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  scheduled_for timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, idempotency_key)
);

create index if not exists notification_outbox_due_idx
  on public.notification_outbox (status, scheduled_for)
  where status in ('pending','failed');
create index if not exists notification_outbox_entity_idx
  on public.notification_outbox (organisation_id, entity_type, entity_id);

create table if not exists public.notification_preferences (
  organisation_id uuid not null,
  email text not null,
  transactional_email_enabled boolean not null default true,
  nurture_email_enabled boolean not null default true,
  reminders_paused_at timestamptz,
  nurture_unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organisation_id, email)
);

alter table public.notification_outbox enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_members_read on public.notification_preferences;
create policy notification_preferences_members_read
on public.notification_preferences for select
using (exists (
  select 1 from public.organisation_memberships m
  where m.organisation_id = notification_preferences.organisation_id
    and m.user_id = auth.uid()
));

create or replace function public.op_enqueue_notification(
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
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_key text;
  v_preferences public.notification_preferences;
begin
  if nullif(trim(p_recipient_email), '') is null then
    raise exception 'Recipient email is required.';
  end if;

  select * into v_preferences
  from public.notification_preferences
  where organisation_id = p_organisation_id
    and lower(email) = lower(p_recipient_email);

  if p_category = 'nurture' and
     (coalesce(v_preferences.nurture_email_enabled, true) = false or v_preferences.nurture_unsubscribed_at is not null) then
    return null;
  end if;
  if p_category = 'reminder' and v_preferences.reminders_paused_at is not null then
    return null;
  end if;
  if p_category = 'transactional' and coalesce(v_preferences.transactional_email_enabled, true) = false then
    return null;
  end if;

  v_key := coalesce(nullif(p_idempotency_key, ''), concat_ws(':', p_event_key, p_entity_type, p_entity_id::text, lower(p_recipient_email), extract(epoch from p_scheduled_for)::bigint));

  insert into public.notification_outbox (
    organisation_id,event_key,category,recipient_email,recipient_name,subject,template_key,payload,
    entity_type,entity_id,scheduled_for,idempotency_key
  ) values (
    p_organisation_id,p_event_key,p_category,lower(trim(p_recipient_email)),nullif(trim(p_recipient_name),''),
    p_subject,p_template_key,coalesce(p_payload,'{}'::jsonb),p_entity_type,p_entity_id,p_scheduled_for,v_key
  )
  on conflict (organisation_id,idempotency_key) do update
    set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.op_cancel_notifications_for_entity(
  p_organisation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_categories text[] default array['reminder','nurture']::text[]
) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  update public.notification_outbox
  set status = 'cancelled', updated_at = now()
  where organisation_id = p_organisation_id
    and entity_type = p_entity_type
    and entity_id = p_entity_id
    and category = any(p_categories)
    and status in ('pending','failed');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.op_schedule_lead_nurture(
  p_organisation_id uuid,
  p_lead_id uuid,
  p_email text,
  p_name text,
  p_company text,
  p_action_url text
) returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer := 0;
begin
  perform public.op_enqueue_notification(p_organisation_id,'lead.nurture.day2',p_email,p_name,
    'A practical way to extend engineering capacity','nurture_capacity',
    jsonb_build_object('name',p_name,'company',p_company,'actionUrl',p_action_url),
    'lead',p_lead_id,'nurture',now()+interval '2 days','lead:nurture:day2:'||p_lead_id); v_count:=v_count+1;
  perform public.op_enqueue_notification(p_organisation_id,'lead.nurture.day5',p_email,p_name,
    'What helps us assess an overflow requirement','nurture_intake',
    jsonb_build_object('name',p_name,'company',p_company,'actionUrl',p_action_url),
    'lead',p_lead_id,'nurture',now()+interval '5 days','lead:nurture:day5:'||p_lead_id); v_count:=v_count+1;
  perform public.op_enqueue_notification(p_organisation_id,'lead.nurture.day10',p_email,p_name,
    'How a controlled overflow project moves from enquiry to delivery','nurture_process',
    jsonb_build_object('name',p_name,'company',p_company,'actionUrl',p_action_url),
    'lead',p_lead_id,'nurture',now()+interval '10 days','lead:nurture:day10:'||p_lead_id); v_count:=v_count+1;
  perform public.op_enqueue_notification(p_organisation_id,'lead.nurture.day18',p_email,p_name,
    'Planning for upcoming engineering capacity','nurture_checkin',
    jsonb_build_object('name',p_name,'company',p_company,'actionUrl',p_action_url),
    'lead',p_lead_id,'nurture',now()+interval '18 days','lead:nurture:day18:'||p_lead_id); v_count:=v_count+1;
  perform public.op_enqueue_notification(p_organisation_id,'lead.nurture.day30',p_email,p_name,
    'A final check-in from Overflow Partner','nurture_final',
    jsonb_build_object('name',p_name,'company',p_company,'actionUrl',p_action_url),
    'lead',p_lead_id,'nurture',now()+interval '30 days','lead:nurture:day30:'||p_lead_id); v_count:=v_count+1;
  return v_count;
end;
$$;

create or replace function public.op_claim_notification_batch(p_limit integer default 20)
returns setof public.notification_outbox
language plpgsql security definer set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.notification_outbox
    where status in ('pending','failed')
      and scheduled_for <= now()
      and attempts < max_attempts
      and (locked_at is null or locked_at < now() - interval '15 minutes')
    order by scheduled_for, created_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  ), claimed as (
    update public.notification_outbox n
    set status='processing', locked_at=now(), attempts=n.attempts+1, updated_at=now()
    from due
    where n.id=due.id
    returning n.*
  )
  select * from claimed;
end;
$$;

create or replace function public.op_complete_notification(
  p_id uuid,
  p_provider_message_id text
) returns void
language sql security definer set search_path = public
as $$
  update public.notification_outbox
  set status='sent', provider_message_id=p_provider_message_id, sent_at=now(), locked_at=null, last_error=null, updated_at=now()
  where id=p_id;
$$;

create or replace function public.op_fail_notification(
  p_id uuid,
  p_error text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.notification_outbox
  set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
      scheduled_for = case when attempts >= max_attempts then scheduled_for else now() + make_interval(mins => least(60, power(2, greatest(attempts,1))::integer * 5)) end,
      last_error = left(coalesce(p_error,'Unknown delivery error'),2000),
      locked_at = null,
      updated_at = now()
  where id=p_id;
end;
$$;

commit;
