-- Isolated-QA-first: client review has SEVEN England/Wales working days
-- from the controlled client transmittal, excluding UK bank holidays.
-- Holiday source: https://www.gov.uk/bank-holidays (England and Wales, 2026-28).
create table if not exists public.op_ew_bank_holidays (
  holiday_date date primary key,
  holiday_name text not null,
  source text not null default 'https://www.gov.uk/bank-holidays'
);
alter table public.op_ew_bank_holidays enable row level security;
revoke all on public.op_ew_bank_holidays from public,anon,authenticated;
grant select on public.op_ew_bank_holidays to service_role;

create table if not exists public.op_review_calendar_years (
  calendar_year integer primary key,
  jurisdiction text not null default 'England and Wales',
  reviewed_at timestamptz not null default now()
);
alter table public.op_review_calendar_years enable row level security;
revoke all on public.op_review_calendar_years from public,anon,authenticated;
grant select on public.op_review_calendar_years to service_role;
insert into public.op_review_calendar_years(calendar_year) values(2026),(2027),(2028)
on conflict(calendar_year) do nothing;

insert into public.op_ew_bank_holidays(holiday_date,holiday_name) values
 ('2026-01-01','New Year Day'),('2026-04-03','Good Friday'),('2026-04-06','Easter Monday'),
 ('2026-05-04','Early May bank holiday'),('2026-05-25','Spring bank holiday'),
 ('2026-08-31','Summer bank holiday'),('2026-12-25','Christmas Day'),
 ('2026-12-28','Boxing Day substitute'),
 ('2027-01-01','New Year Day'),('2027-03-26','Good Friday'),
 ('2027-03-29','Easter Monday'),('2027-05-03','Early May bank holiday'),
 ('2027-05-31','Spring bank holiday'),('2027-08-30','Summer bank holiday'),
 ('2027-12-27','Christmas Day substitute'),('2027-12-28','Boxing Day substitute'),
 ('2028-01-03','New Year Day substitute'),('2028-04-14','Good Friday'),
 ('2028-04-17','Easter Monday'),('2028-05-01','Early May bank holiday'),
 ('2028-05-29','Spring bank holiday'),('2028-08-28','Summer bank holiday'),
 ('2028-12-25','Christmas Day'),('2028-12-26','Boxing Day')
on conflict(holiday_date) do nothing;

create or replace function public.op_client_review_due_at(p_issued_at timestamptz,p_workdays integer default 7)
returns timestamptz language plpgsql stable set search_path=public as $$
declare v_date date;v_count integer:=0;
begin
  if p_issued_at is null or p_workdays<1 or p_workdays>60 then
    raise exception 'Valid transmittal date and 1-60 working days required.'; end if;
  v_date := (p_issued_at at time zone 'Europe/London')::date;
  while v_count<p_workdays loop
    v_date:=v_date+1;
    if not exists(select 1 from public.op_review_calendar_years c
                  where c.calendar_year=extract(year from v_date)::integer) then
      raise exception 'England/Wales business calendar not configured for %',extract(year from v_date)::integer;
    end if;
    if extract(isodow from v_date)::integer<6
      and not exists(select 1 from public.op_ew_bank_holidays h where h.holiday_date=v_date) then
      v_count:=v_count+1;
    end if;
  end loop;
  return (v_date + time '23:59:59') at time zone 'Europe/London';
end;$$;
revoke all on function public.op_client_review_due_at(timestamptz,integer) from public,anon;
grant execute on function public.op_client_review_due_at(timestamptz,integer) to authenticated,service_role;

alter table public.project_client_transmittals
  add column if not exists review_due_at timestamptz;

create or replace function public.op_set_seven_workday_client_review()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.review_due_at is null then
    new.review_due_at:=public.op_client_review_due_at(coalesce(new.issued_at,now()),7);
  end if;
  return new;
end;$$;
drop trigger if exists op_seven_workday_client_review on public.project_client_transmittals;
create trigger op_seven_workday_client_review before insert on public.project_client_transmittals
for each row execute function public.op_set_seven_workday_client_review();

create or replace function public.op_get_client_review_window(
 p_organisation_id uuid,p_user_id uuid,p_project_id uuid
) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_row public.project_client_transmittals%rowtype;v_outcome text;
begin
  if auth.uid() is distinct from p_user_id then raise exception 'Authenticated workspace actor required.'; end if;
  perform public.op_assert_workspace_role(p_organisation_id,p_user_id,
    array['owner','admin','operator','engineering','commercial']);
  select * into v_row from public.project_client_transmittals
    where organisation_id=p_organisation_id and project_id=p_project_id
    order by issued_at desc limit 1;
  if not found then return jsonb_build_object('issued',false); end if;
  select r.outcome into v_outcome from public.project_client_reviews r
    where r.project_id=p_project_id and r.organisation_id=p_organisation_id
      and r.transmittal_id=v_row.id order by r.recorded_at desc limit 1;
  return jsonb_build_object('issued',true,'dueAt',v_row.review_due_at,
    'expired',v_row.review_due_at<now(),'outcome',v_outcome);
end;$$;
revoke all on function public.op_get_client_review_window(uuid,uuid,uuid) from public,anon;
grant execute on function public.op_get_client_review_window(uuid,uuid,uuid) to authenticated;
