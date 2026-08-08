-- Overflow Partner — controlled transactional test-data reset
--
-- Purpose
-- Remove dummy/transactional business records while preserving platform/config data:
-- auth users, profiles, organisations, memberships, roles/permissions, partners,
-- companies, contacts, templates/configuration, RLS, functions, triggers and schema.
--
-- STRATEGY
-- Start from a known transactional seed set, then recursively include PUBLIC child
-- tables that FK-reference those transactional tables. This prevents repeated
-- "cannot truncate referenced table" failures as the schema evolves.
--
-- SAFETY
-- 1. Runs in one transaction.
-- 2. NO CASCADE is used.
-- 3. Protected platform/configuration tables are NEVER auto-added.
-- 4. If a protected table references transactional data, reset aborts.
-- 5. Missing optional seed tables are skipped.
-- 6. All selected tables are truncated together in one atomic statement.
--
-- Run this ENTIRE file in Supabase SQL Editor.

begin;

select set_config('op.test_reset_confirmation', 'RESET_OVERFLOW_PARTNER_TEST_DATA', true);

do $$
begin
  if current_setting('op.test_reset_confirmation', true) <> 'RESET_OVERFLOW_PARTNER_TEST_DATA' then
    raise exception 'Reset confirmation missing. No data was deleted.';
  end if;
end $$;

create temporary table _op_reset_targets (
  table_name text primary key,
  relid oid not null unique,
  source text not null
) on commit drop;

create temporary table _op_reset_protected (
  table_name text primary key
) on commit drop;

insert into _op_reset_protected(table_name) values
  ('profiles'),
  ('organisations'),
  ('organization'),
  ('organisation_members'),
  ('organization_members'),
  ('memberships'),
  ('roles'),
  ('permissions'),
  ('role_permissions'),
  ('partners'),
  ('companies'),
  ('contacts'),
  ('document_templates'),
  ('notification_templates'),
  ('system_settings'),
  ('app_settings'),
  ('reference_data')
on conflict do nothing;

-- Known transactional roots / common children.
do $$
declare
  t text;
  r regclass;
  seeds text[] := array[
    -- Acquisition / intake
    'prospect_technical_reviews',
    'intake_files',
    'intake_submissions',
    'intake_sessions',
    'prospects',

    -- Case / technical workflow
    'files',
    'technical_intakes',
    'leads',

    -- Partner / commercial workflow
    'partner_review_internal_decisions',
    'partner_review_responses',
    'partner_review_files',
    'partner_review_requests',
    'partner_quotes',
    'commercial_reviews',
    'quotes',

    -- Project / operations
    'project_stage_events',
    'project_stage_history',
    'project_activities',
    'activity_events',
    'tasks',
    'risk_register',
    'compliance_register',
    'projects',

    -- Documents / evidence
    'document_signatures',
    'document_approvals',
    'document_reviews',
    'document_versions',
    'document_files',
    'documents',

    -- Finance
    'partner_payments',
    'payments',
    'partner_payables',
    'invoices',
    'billing_milestones',
    'commercial_terms',

    -- Communications / notifications
    'notification_deliveries',
    'notification_queue',
    'notifications',
    'communication_events',
    'communications'
  ];
begin
  foreach t in array seeds loop
    r := to_regclass(format('public.%I', t));
    if r is not null then
      insert into _op_reset_targets(table_name, relid, source)
      values (t, r::oid, 'seed')
      on conflict (table_name) do nothing;
    end if;
  end loop;

  if not exists (select 1 from _op_reset_targets) then
    raise exception 'No recognised Overflow Partner transactional tables were found. Reset aborted.';
  end if;
end $$;

-- Recursively include PUBLIC FK child tables of transactional targets.
-- This closes over the dependency graph without CASCADE.
do $$
declare
  added integer;
  dep record;
begin
  loop
    added := 0;

    for dep in
      select distinct
        child.oid as child_oid,
        child.relname as child_table,
        fk.conname as fk_name,
        parent_target.table_name as parent_table
      from pg_constraint fk
      join _op_reset_targets parent_target
        on parent_target.relid = fk.confrelid
      join pg_class child
        on child.oid = fk.conrelid
      join pg_namespace child_ns
        on child_ns.oid = child.relnamespace
      left join _op_reset_targets child_target
        on child_target.relid = child.oid
      where fk.contype = 'f'
        and child_ns.nspname = 'public'
        and child_target.relid is null
      order by child.relname, fk.conname
    loop
      if exists (
        select 1 from _op_reset_protected p where p.table_name = dep.child_table
      ) then
        raise exception
          'Reset aborted: protected table public.% (% FK) references transactional table public.%.',
          dep.child_table, dep.fk_name, dep.parent_table;
      end if;

      insert into _op_reset_targets(table_name, relid, source)
      values (dep.child_table, dep.child_oid, format('fk-child of %s via %s', dep.parent_table, dep.fk_name))
      on conflict (table_name) do nothing;

      if found then
        added := added + 1;
        raise notice 'Auto-including transactional FK child public.% (%).', dep.child_table, dep.fk_name;
      end if;
    end loop;

    exit when added = 0;
  end loop;
end $$;

-- Final guard: after closure there must be no PUBLIC child table outside the reset set.
do $$
declare
  dep record;
begin
  select
    child.relname as child_table,
    fk.conname as fk_name,
    parent_target.table_name as parent_table
  into dep
  from pg_constraint fk
  join _op_reset_targets parent_target
    on parent_target.relid = fk.confrelid
  join pg_class child
    on child.oid = fk.conrelid
  join pg_namespace child_ns
    on child_ns.oid = child.relnamespace
  left join _op_reset_targets child_target
    on child_target.relid = child.oid
  where fk.contype = 'f'
    and child_ns.nspname = 'public'
    and child_target.relid is null
  limit 1;

  if dep.child_table is not null then
    raise exception 'Reset dependency closure incomplete: public.% (%) still references public.%.',
      dep.child_table, dep.fk_name, dep.parent_table;
  end if;
end $$;

-- Capture before counts.
create temporary table _op_reset_counts_before (
  table_name text primary key,
  row_count bigint not null
) on commit drop;

do $$
declare
  r record;
  c bigint;
begin
  for r in select table_name from _op_reset_targets order by table_name loop
    execute format('select count(*) from public.%I', r.table_name) into c;
    insert into _op_reset_counts_before(table_name, row_count)
    values (r.table_name, c);
  end loop;
end $$;

-- Atomic wipe. No CASCADE.
do $$
declare
  table_list text;
  target_count integer;
begin
  select string_agg(format('public.%I', table_name), ', ' order by table_name), count(*)
    into table_list, target_count
  from _op_reset_targets;

  if coalesce(table_list, '') = '' then
    raise exception 'Transactional reset table list is empty. Reset aborted.';
  end if;

  raise notice 'Truncating % transactional tables atomically.', target_count;
  execute 'truncate table ' || table_list || ' restart identity';
end $$;

-- Verify all targets are empty.
do $$
declare
  r record;
  c bigint;
begin
  for r in select table_name from _op_reset_targets order by table_name loop
    execute format('select count(*) from public.%I', r.table_name) into c;
    if c <> 0 then
      raise exception 'Reset verification failed: public.% still contains % row(s).', r.table_name, c;
    end if;
  end loop;
end $$;

-- Human-readable report.
select
  t.table_name,
  t.source,
  b.row_count as rows_before,
  0::bigint as rows_after,
  b.row_count as rows_deleted
from _op_reset_targets t
join _op_reset_counts_before b using (table_name)
order by t.table_name;

commit;

-- INTENTIONALLY PRESERVED
-- auth.users
-- public.profiles
-- organisations / memberships
-- roles / permissions
-- partners
-- companies
-- contacts
-- templates / configuration / reference data
-- database schema, RLS, functions, triggers and migrations
--
-- NOTE: Supabase Storage objects are NOT deleted by this SQL reset.
