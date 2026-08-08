-- Active workflow uniqueness guards.
-- These are trigger-based rather than unique indexes so historical test rows
-- do not prevent the migration from being applied.

create or replace function public.op_integrity_guard_single_technical_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.technical_intakes t
    where t.organisation_id=new.organisation_id and t.lead_id=new.lead_id and t.id<>new.id
  ) then
    raise exception 'OS_INTEGRITY: A Technical Scope already exists for this Case.' using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_single_technical_scope on public.technical_intakes;
create trigger trg_os_integrity_single_technical_scope
before insert or update of lead_id on public.technical_intakes
for each row execute function public.op_integrity_guard_single_technical_scope();

create or replace function public.op_integrity_guard_single_active_partner_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('draft','issued','opened','submitted','clarification_required') and exists (
    select 1 from public.partner_review_requests r
    where r.organisation_id=new.organisation_id and r.lead_id=new.lead_id and r.id<>new.id
      and r.status in ('draft','issued','opened','submitted','clarification_required')
  ) then
    raise exception 'OS_INTEGRITY: An active Partner Review already exists for this Case.' using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_single_active_partner_review on public.partner_review_requests;
create trigger trg_os_integrity_single_active_partner_review
before insert or update of status, lead_id on public.partner_review_requests
for each row execute function public.op_integrity_guard_single_active_partner_review();

create or replace function public.op_integrity_guard_partner_pricing_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_review_request_id is not null and exists (
    select 1 from public.partner_quotes q
    where q.organisation_id=new.organisation_id
      and q.partner_review_request_id=new.partner_review_request_id
      and q.id<>new.id
      and q.status not in ('declined','expired')
  ) then
    raise exception 'OS_INTEGRITY: Partner pricing already exists for this Partner Review request.' using errcode='23505';
  end if;
  if new.status='selected' and exists (
    select 1 from public.partner_quotes q
    where q.organisation_id=new.organisation_id and q.lead_id=new.lead_id and q.id<>new.id and q.status='selected'
  ) then
    raise exception 'OS_INTEGRITY: This Case already has selected partner pricing.' using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_partner_pricing_request on public.partner_quotes;
create trigger trg_os_integrity_partner_pricing_request
before insert or update of status, partner_review_request_id, lead_id on public.partner_quotes
for each row execute function public.op_integrity_guard_partner_pricing_request();

create or replace function public.op_integrity_guard_single_commercial_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('draft','pending_approval','approved') and exists (
    select 1 from public.commercial_reviews c
    where c.organisation_id=new.organisation_id and c.lead_id=new.lead_id and c.id<>new.id
      and c.status in ('draft','pending_approval','approved')
  ) then
    raise exception 'OS_INTEGRITY: An active Commercial Review already exists for this Case.' using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_single_commercial_review on public.commercial_reviews;
create trigger trg_os_integrity_single_commercial_review
before insert or update of status, lead_id on public.commercial_reviews
for each row execute function public.op_integrity_guard_single_commercial_review();

create or replace function public.op_integrity_guard_single_client_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('draft','internal_review','issued','accepted') and exists (
    select 1 from public.quotes q
    where q.organisation_id=new.organisation_id and q.lead_id=new.lead_id and q.id<>new.id
      and q.status in ('draft','internal_review','issued','accepted')
  ) then
    raise exception 'OS_INTEGRITY: An active Client Quote already exists for this Case. Revise the existing quote instead.' using errcode='23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_single_client_quote on public.quotes;
create trigger trg_os_integrity_single_client_quote
before insert or update of status, lead_id on public.quotes
for each row execute function public.op_integrity_guard_single_client_quote();
