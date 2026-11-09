-- QA-FIRST governance: back-to-back Execution Partner Agreement evidence.
-- This table records independently verified signed agreement evidence. It does
-- not itself execute any legal document, infer signatures or approve a Partner.
create table if not exists public.partner_execution_agreement_evidence (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  partner_id uuid not null references public.partners(id),
  agreement_reference text not null check (length(trim(agreement_reference))>=8),
  agreement_version text not null check (length(trim(agreement_version))>=2),
  signed_by_name text not null check (length(trim(signed_by_name))>=2),
  signed_at timestamptz not null,
  verified_by uuid not null references public.profiles(id),
  verified_at timestamptz not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organisation_id,partner_id,agreement_version)
);
create unique index if not exists ux_current_partner_execution_agreement
on public.partner_execution_agreement_evidence (organisation_id,partner_id)
where is_current=true;
alter table public.partner_execution_agreement_evidence enable row level security;
revoke all on public.partner_execution_agreement_evidence from public,anon,authenticated;
grant select,insert,update on public.partner_execution_agreement_evidence to service_role;
grant select on public.partner_execution_agreement_evidence to authenticated;
create policy op_partner_agreement_member_read
on public.partner_execution_agreement_evidence for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id=auth.uid() and p.organisation_id=partner_execution_agreement_evidence.organisation_id
    and p.is_active=true
));

-- Database-level release guard; a role or compromised UI cannot manufacture
-- an assignment for a Partner without independently checked contract evidence.
create or replace function public.op_guard_execution_partner_agreement()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists (
    select 1 from public.partner_execution_agreement_evidence a
    join public.profiles reviewer on reviewer.id=a.verified_by
    where a.organisation_id=new.organisation_id and a.partner_id=new.partner_id
      and a.is_current and a.signed_at<=a.verified_at and a.verified_at<=now()
      and reviewer.organisation_id=new.organisation_id and reviewer.is_active
      and reviewer.role::text in ('owner','admin')
  ) then
    raise exception 'A signed, independently verified Execution Partner Agreement is required before Work Order assignment.';
  end if;
  return new;
end;$$;
drop trigger if exists trg_op_execution_partner_agreement_before_assignment on public.project_execution_assignments;
create trigger trg_op_execution_partner_agreement_before_assignment
before insert or update of partner_id on public.project_execution_assignments
for each row execute function public.op_guard_execution_partner_agreement();

-- An agreement that is superseded after assignment must also block acceptance.
create or replace function public.op_guard_work_order_acceptance_partner_agreement()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists (
    select 1 from public.partner_execution_agreement_evidence a
    join public.profiles reviewer on reviewer.id=a.verified_by
    where a.organisation_id=new.organisation_id and a.partner_id=new.partner_id
      and a.is_current and a.signed_at<=a.verified_at and a.verified_at<=now()
      and reviewer.organisation_id=new.organisation_id and reviewer.is_active
      and reviewer.role::text in ('owner','admin')
  ) then raise exception 'Execution Partner Agreement evidence must remain current for Work Order acceptance.'; end if;
  return new;
end;$$;
drop trigger if exists trg_op_partner_agreement_before_wo_acceptance on public.partner_work_order_acceptances;
create trigger trg_op_partner_agreement_before_wo_acceptance
before insert on public.partner_work_order_acceptances
for each row execute function public.op_guard_work_order_acceptance_partner_agreement();
