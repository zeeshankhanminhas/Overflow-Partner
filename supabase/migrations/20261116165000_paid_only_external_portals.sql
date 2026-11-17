-- OPOS paid-only external dashboards. Isolated QA first; no production migration without sign-off.
-- Separate external membership from Controller profiles so external users do not
-- inherit broad organisation-wide internal RLS grants.
begin;

create table if not exists public.external_portal_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  portal_kind text not null check (portal_kind in ('client','partner')),
  company_id uuid references public.companies(id) on delete restrict,
  partner_id uuid references public.partners(id) on delete restrict,
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint op_external_member_subject_check check (
    (portal_kind='client' and company_id is not null and partner_id is null)
    or (portal_kind='partner' and partner_id is not null and company_id is null)
  )
);

create unique index if not exists op_external_member_scope_uid
on public.external_portal_memberships(
  auth_user_id, organisation_id, portal_kind,
  coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(partner_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create or replace function public.op_validate_external_portal_membership()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if exists (
    select 1 from public.profiles profile
    where profile.id=new.auth_user_id
      and profile.is_active=true
  ) then raise exception 'External portal membership cannot use active Controller organisation profile'; end if;
  if new.portal_kind='client' and not exists (
    select 1 from public.companies c
    where c.id=new.company_id and c.organisation_id=new.organisation_id
  ) then raise exception 'Client account must belong to membership organisation'; end if;
  if new.portal_kind='partner' and not exists (
    select 1 from public.partners p
    where p.id=new.partner_id and p.organisation_id=new.organisation_id
  ) then raise exception 'Partner account must belong to membership organisation'; end if;
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists op_validate_external_portal_membership_trigger
on public.external_portal_memberships;
create trigger op_validate_external_portal_membership_trigger
before insert or update on public.external_portal_memberships
for each row execute function public.op_validate_external_portal_membership();

alter table public.external_portal_memberships enable row level security;
revoke all on public.external_portal_memberships from public,anon,authenticated;
grant select,insert,update,delete on public.external_portal_memberships to service_role;
revoke all on function public.op_validate_external_portal_membership() from public,anon,authenticated;
grant execute on function public.op_validate_external_portal_membership() to service_role;

-- A membership does not itself unlock any project. This purpose-limited
-- function is only for selecting the correct landing page for an already
-- authenticated user, with no Controller records or arbitrary account search.
create or replace function public.portal_my_workspaces()
returns table(
  portal_kind text, organisation_id uuid, account_id uuid, account_name text
)
language sql stable security definer set search_path='' as $$
  select m.portal_kind,m.organisation_id,
    case when m.portal_kind='client' then m.company_id else m.partner_id end,
    case when m.portal_kind='client' then c.name else pt.company_name end
  from public.external_portal_memberships m
  left join public.companies c on c.id=m.company_id and c.organisation_id=m.organisation_id
  left join public.partners pt on pt.id=m.partner_id and pt.organisation_id=m.organisation_id
  where auth.role()='authenticated' and m.auth_user_id=(select auth.uid()) and m.is_active
    and not exists (
      select 1 from public.profiles internal where internal.id=m.auth_user_id and internal.is_active
    )
  order by m.portal_kind,m.created_at
$$;

-- Mandatory REAL opening-payment evidence for both roles. PO, credit and
-- no-advance exceptions may release a governed project commercially but NEVER
-- release an external dashboard. Signed checkout success alone is insufficient.
-- Extra partner condition: issued and accepted WO, assigned/released execution
-- and approved partner. All joins are tied to exact organisation/project.
create or replace function public.portal_my_projects(p_kind text)
returns table(
  portal_kind text, organisation_id uuid, account_id uuid, account_name text,
  project_id uuid, project_number text, project_title text, project_stage text,
  project_status text, due_date date, reference text, amount numeric,
  currency text, work_order_accepted boolean, partner_execution_state text,
  progress_state text
)
language plpgsql stable security definer set search_path='' as $function$
begin
  if auth.role() <> 'authenticated' or p_kind not in ('client','partner') then
    return;
  end if;

  if p_kind='client' then
    return query
      select distinct on (m.id,pr.id)
        m.portal_kind,m.organisation_id,m.company_id,c.name,
        pr.id,pr.project_number,pr.title,pr.project_stage,pr.status::text,pr.due_date,
        q.quote_number,q.total,q.currency::text,
        false,null::text,null::text
      from public.external_portal_memberships m
      join public.companies c on c.id=m.company_id and c.organisation_id=m.organisation_id
      join public.projects pr on pr.organisation_id=m.organisation_id
      join public.leads l on l.id=pr.lead_id and l.organisation_id=m.organisation_id
        and l.company_id=m.company_id
      join public.quotes q on q.id=pr.quote_id and q.organisation_id=m.organisation_id
      join public.quote_payment_confirmations payment
        on payment.quote_id=pr.quote_id
        and payment.organisation_id=pr.organisation_id
        and payment.lead_id=pr.lead_id
        and payment.amount > 0
        and payment.confirmed_at is not null
      where m.auth_user_id=(select auth.uid())
        and m.is_active and m.portal_kind='client'
        and not exists (
          select 1 from public.profiles internal where internal.id=m.auth_user_id and internal.is_active
        )
        and pr.status::text <> 'cancelled'
      order by m.id,pr.id;
    return;
  end if;

  -- Clean migration-built databases may not yet have the governed Partner
  -- Work Order tables. Never invent those tables or treat an assignment alone
  -- as acceptance. Fail closed, with zero Partner dashboard projects.
  if to_regclass('public.partner_work_orders') is null
     or to_regclass('public.partner_work_order_acceptances') is null
     or to_regclass('public.project_execution_assignments') is null
     or to_regclass('public.partner_progress_updates') is null then
    return;
  end if;

  -- Dynamic SQL is deliberately limited to this constant trusted query
  -- because missing Work Order relations must not break clean migration runs.
  -- No user-provided string is interpolated.
  return query execute $partnerquery$
    select distinct on (m.id,pr.id)
      m.portal_kind,m.organisation_id,m.partner_id,pt.company_name,
      pr.id,pr.project_number,pr.title,pr.project_stage,pr.status::text,pr.due_date,
      wo.reference,wo.partner_price,wo.currency,
      true,a.execution_state,pu.progress_state
    from public.external_portal_memberships m
    join public.partners pt on pt.id=m.partner_id
      and pt.organisation_id=m.organisation_id
      and pt.status::text='approved'
    join public.projects pr on pr.organisation_id=m.organisation_id
    join public.quotes q on q.id=pr.quote_id and q.organisation_id=m.organisation_id
    join public.quote_payment_confirmations payment
      on payment.quote_id=pr.quote_id
      and payment.organisation_id=pr.organisation_id
      and payment.lead_id=pr.lead_id
      and payment.amount > 0
      and payment.confirmed_at is not null
    join public.project_execution_assignments a
      on a.organisation_id=m.organisation_id
      and a.project_id=pr.id
      and a.partner_id=m.partner_id
      and a.released_at is not null
      and a.execution_state <> 'cancelled'
    join public.partner_work_orders wo on wo.assignment_id=a.id
      and wo.project_id=pr.id
      and wo.organisation_id=m.organisation_id
      and wo.partner_id=m.partner_id
      and wo.issued_at is not null
    join public.partner_work_order_acceptances acceptance
      on acceptance.organisation_id=m.organisation_id
      and acceptance.project_id=pr.id
      and acceptance.assignment_id=a.id
      and acceptance.partner_id=m.partner_id
      and acceptance.accepted_at is not null
    left join lateral (
      select updates.progress_state
      from public.partner_progress_updates updates
      where updates.organisation_id=m.organisation_id
        and updates.assignment_id=a.id
      order by updates.submitted_at desc limit 1
    ) pu on true
    where m.auth_user_id=(select auth.uid())
      and m.is_active and m.portal_kind='partner'
      and not exists (
        select 1 from public.profiles internal where internal.id=m.auth_user_id and internal.is_active
      )
      and pr.status::text <> 'cancelled'
    order by m.id,pr.id
  $partnerquery$;
end
$function$;

revoke all on function public.portal_my_workspaces() from public,anon;
grant execute on function public.portal_my_workspaces() to authenticated,service_role;
revoke all on function public.portal_my_projects(text) from public,anon;
grant execute on function public.portal_my_projects(text) to authenticated,service_role;
commit;
