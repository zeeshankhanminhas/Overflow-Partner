-- Persistent Client and Execution Partner account access.
-- No automatic email matching and no direct external reads of internal tables.
-- All queries use explicit auth user -> entity membership with organisation scope.
create table if not exists public.external_portal_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  portal_kind text not null check (portal_kind in ('client','partner')),
  company_id uuid references public.companies(id) on delete restrict,
  partner_id uuid references public.partners(id) on delete restrict,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_portal_exact_entity check (
    (portal_kind='client' and company_id is not null and partner_id is null) or
    (portal_kind='partner' and partner_id is not null and company_id is null)
  )
);
create unique index if not exists external_portal_one_client_membership
  on public.external_portal_memberships(auth_user_id,organisation_id,company_id)
  where portal_kind='client';
create unique index if not exists external_portal_one_partner_membership
  on public.external_portal_memberships(auth_user_id,organisation_id,partner_id)
  where portal_kind='partner';
create index if not exists external_portal_memberships_active_user
  on public.external_portal_memberships(auth_user_id,portal_kind) where is_active;

create or replace function public.op_validate_external_portal_membership()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.portal_kind='client' and not exists(
    select 1 from public.companies c
    where c.id=new.company_id and c.organisation_id=new.organisation_id
  ) then raise exception 'Client membership company is outside its organisation'; end if;
  if new.portal_kind='partner' and not exists(
    select 1 from public.partners p
    where p.id=new.partner_id and p.organisation_id=new.organisation_id
  ) then raise exception 'Partner membership entity is outside its organisation'; end if;
  new.updated_at=now();
  return new;
end $$;
drop trigger if exists external_portal_membership_org_guard on public.external_portal_memberships;
create trigger external_portal_membership_org_guard
 before insert or update on public.external_portal_memberships
 for each row execute function public.op_validate_external_portal_membership();

alter table public.external_portal_memberships enable row level security;
revoke all on public.external_portal_memberships from public,anon,authenticated;
grant select on public.external_portal_memberships to authenticated;
grant all on public.external_portal_memberships to service_role;
drop policy if exists external_portal_members_can_read_own on public.external_portal_memberships;
create policy external_portal_members_can_read_own on public.external_portal_memberships
 for select to authenticated
 using (auth_user_id=(select auth.uid()));
-- Intentionally NO user INSERT/UPDATE/DELETE policy. Granting, changing and
-- revoking access is an OP administrative service workflow, never self service.

create or replace function public.portal_my_workspaces()
returns table(portal_kind text,organisation_id uuid,account_id uuid,account_name text)
language sql stable security definer set search_path=''
as $$
select m.portal_kind,m.organisation_id,
 case when m.portal_kind='client' then m.company_id else m.partner_id end as account_id,
 case when m.portal_kind='client' then c.name else p.company_name end as account_name
from public.external_portal_memberships m
left join public.companies c on c.id=m.company_id and c.organisation_id=m.organisation_id
left join public.partners p on p.id=m.partner_id and p.organisation_id=m.organisation_id
where m.auth_user_id=(select auth.uid()) and m.is_active
  and auth.role()='authenticated'
order by m.portal_kind,account_name;
$$;

create or replace function public.portal_my_projects(p_kind text)
returns table(
 portal_kind text,organisation_id uuid,account_id uuid,account_name text,
 project_id uuid,project_number text,project_title text,project_stage text,
 project_status text,due_date date,reference text,amount numeric,currency text,
 work_order_accepted boolean,partner_execution_state text,progress_state text
)
language sql stable security definer set search_path=''
as $$
select distinct on (m.id,pr.id)
 m.portal_kind,m.organisation_id,
 case when m.portal_kind='client' then m.company_id else m.partner_id end,
 case when m.portal_kind='client' then c.name else pt.company_name end,
 pr.id,pr.project_number,pr.title,pr.project_stage,pr.status::text,pr.due_date,
 case when m.portal_kind='client' then q.quote_number else wo.reference end,
 case when m.portal_kind='client' then q.total else wo.partner_price end,
 case when m.portal_kind='client' then q.currency::text else wo.currency end,
 case when m.portal_kind='partner' then exists(
   select 1 from public.partner_work_order_acceptances wa
    where wa.assignment_id=a.id and wa.project_id=pr.id
      and wa.partner_id=m.partner_id and wa.organisation_id=m.organisation_id
 ) else false end,
 case when m.portal_kind='partner' then a.execution_state else null end,
 case when m.portal_kind='partner' then pu.progress_state else null end
from public.external_portal_memberships m
join public.projects pr on pr.organisation_id=m.organisation_id
join public.leads l on l.id=pr.lead_id and l.organisation_id=m.organisation_id
left join public.companies c on c.id=m.company_id and c.organisation_id=m.organisation_id
left join public.partners pt on pt.id=m.partner_id and pt.organisation_id=m.organisation_id
left join public.quotes q on q.id=pr.quote_id and q.organisation_id=m.organisation_id
left join lateral (
 select ea.id,ea.partner_id,ea.execution_state
 from public.project_execution_assignments ea
 where ea.organisation_id=m.organisation_id and ea.project_id=pr.id
   and ea.partner_id=m.partner_id
 order by ea.created_at desc limit 1
) a on m.portal_kind='partner'
left join public.partner_work_orders wo on wo.assignment_id=a.id
 and wo.project_id=pr.id and wo.organisation_id=m.organisation_id
left join lateral (
 select pu.progress_state from public.partner_progress_updates pu
 where pu.assignment_id=a.id and pu.organisation_id=m.organisation_id
 order by pu.submitted_at desc limit 1
) pu on m.portal_kind='partner'
where auth.role()='authenticated' and m.auth_user_id=(select auth.uid())
 and m.is_active and m.portal_kind=p_kind and p_kind in ('client','partner')
 and ((m.portal_kind='client' and l.company_id=m.company_id) or
      (m.portal_kind='partner' and a.id is not null and wo.id is not null))
order by m.id,pr.id;
$$;

create or replace function public.portal_my_quotations()
returns table(
 organisation_id uuid,account_id uuid,lead_id uuid,lead_reference text,
 lead_title text,quote_id uuid,quote_number text,quote_revision integer,
 total numeric,currency text,client_response text,project_id uuid
)
language sql stable security definer set search_path=''
as $$
select distinct on (m.id,q.id)
 m.organisation_id,m.company_id,l.id,l.reference,
 coalesce(nullif(l.title,''),l.project_type,l.company_name),q.id,q.quote_number,q.revision,
 q.total,q.currency::text,coalesce(qir.client_response::text,'awaiting_response'),
 pr.id
from public.external_portal_memberships m
join public.leads l on l.organisation_id=m.organisation_id and l.company_id=m.company_id
join public.quotes q on q.lead_id=l.id and q.organisation_id=m.organisation_id
join public.quote_issue_records qir on qir.quote_id=q.id
 and qir.organisation_id=m.organisation_id and qir.quote_revision=q.revision
left join public.projects pr on pr.quote_id=q.id and pr.organisation_id=m.organisation_id
where m.portal_kind='client' and m.is_active and m.auth_user_id=(select auth.uid())
 and auth.role()='authenticated'
 and q.status::text in ('issued','accepted')
order by m.id,q.id;
$$;

revoke all on function public.portal_my_workspaces() from public,anon;
revoke all on function public.portal_my_projects(text) from public,anon;
revoke all on function public.portal_my_quotations() from public,anon;
grant execute on function public.portal_my_workspaces() to authenticated;
grant execute on function public.portal_my_projects(text) to authenticated;
grant execute on function public.portal_my_quotations() to authenticated;

comment on table public.external_portal_memberships is
  'Explicit authenticated external account-to-company/partner entitlements. No self-enrolment or implicit email-based authorisation.';
comment on function public.portal_my_projects(text) is
  'Read-only external project summary with independently enforced membership and role-specific financial fields; never exposes documents or raw portal tokens.';
