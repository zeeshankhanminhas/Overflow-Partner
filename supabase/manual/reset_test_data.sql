-- Overflow Partner — controlled test-data reset
-- Purpose: remove transactional / dummy business data without dropping schema,
-- auth users, profiles, organisations, roles, permissions, partners, companies,
-- contacts, configuration, RLS, functions, triggers, or migrations.
--
-- SAFETY MODEL
-- 1. Runs in one transaction.
-- 2. Calculates child -> parent deletion order from PostgreSQL foreign keys.
-- 3. Does NOT use CASCADE.
-- 4. Missing optional tables are skipped.
-- 5. Any unexpected dependency from a preserved table aborts the transaction.
-- 6. Nullable FK cycles between reset-target tables are broken only by setting
--    those temporary lineage/reference columns to NULL inside this transaction.
-- 7. Non-nullable FK cycles still abort the reset.
-- 8. Temporarily disables USER/business triggers only while deleting test data.
--    PostgreSQL internal FK constraint triggers remain enabled.
-- 9. USER/business triggers are re-enabled before commit.
--
-- Run this entire file in the Supabase SQL Editor.

begin;

-- Explicit operator acknowledgement.
select set_config('op.test_reset_confirmation', 'RESET_OVERFLOW_PARTNER_TEST_DATA', true);

do $$
begin
  if current_setting('op.test_reset_confirmation', true) <> 'RESET_OVERFLOW_PARTNER_TEST_DATA' then
    raise exception 'Reset confirmation missing. No data was deleted.';
  end if;
end $$;

-- Known transactional tables. Platform/configuration tables are intentionally absent.
create temporary table _op_reset_targets (
  table_name text primary key,
  relid oid not null unique,
  deleted boolean not null default false
) on commit drop;

do $$
declare
  t text;
  targets text[] := array[
    -- Notifications / communications
    'notification_deliveries',
    'notification_queue',
    'notifications',
    'communication_events',
    'communications',

    -- Document workflow children and records
    'document_signatures',
    'document_approvals',
    'document_reviews',
    'document_versions',
    'document_files',
    'documents',

    -- Partner review / commercial workflow
    'partner_review_internal_decisions',
    'partner_review_responses',
    'partner_review_files',
    'partner_review_requests',
    'partner_quotes',
    'commercial_reviews',
    'quotes',

    -- Finance
    'partner_payments',
    'payments',
    'partner_payables',
    'invoices',
    'billing_milestones',
    'commercial_terms',

    -- Project / workflow
    'project_stage_events',
    'project_stage_history',
    'project_activities',
    'activity_events',
    'tasks',
    'risk_register',
    'compliance_register',
    'projects',

    -- Case / technical workflow
    'technical_intakes',
    'leads',

    -- Acquisition
    'prospect_technical_reviews',
    'intake_sessions',
    'prospects'
  ];
  r regclass;
begin
  foreach t in array targets loop
    r := to_regclass(format('public.%I', t));
    if r is not null then
      insert into _op_reset_targets(table_name, relid)
      values (t, r::oid)
      on conflict (table_name) do nothing;
    end if;
  end loop;
end $$;

-- Capture before counts.
create temporary table _op_reset_counts_before (
  table_name text primary key,
  row_count bigint not null
) on commit drop;

create temporary table _op_reset_counts_after (
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
    insert into _op_reset_counts_before(table_name, row_count) values (r.table_name, c);
  end loop;
end $$;

-- Suspend application/business triggers during teardown.
-- DISABLE TRIGGER USER leaves PostgreSQL's internal FK constraint triggers active,
-- so referential integrity is still enforced and unexpected dependencies still abort.
do $$
declare
  r record;
begin
  for r in select table_name from _op_reset_targets order by table_name loop
    raise notice 'Temporarily disabling USER triggers on public.%', r.table_name;
    execute format('alter table public.%I disable trigger user', r.table_name);
  end loop;
end $$;

-- Dependency-aware deletion.
-- A table is safe to delete when no remaining reset-target table has a foreign key
-- pointing to it. If a true cycle remains, we may break one nullable FK edge by
-- setting its child column(s) to NULL. This is safe here because both tables are
-- transactional reset targets and all affected rows are about to be deleted.
do $$
declare
  candidate record;
  remaining_count integer;
  blocker record;
  breakable_fk record;
  set_clause text;
begin
  loop
    select count(*) into remaining_count
    from _op_reset_targets
    where deleted = false;

    exit when remaining_count = 0;

    candidate := null;

    select t.table_name, t.relid
      into candidate
    from _op_reset_targets t
    where t.deleted = false
      and not exists (
        select 1
        from pg_constraint fk
        join _op_reset_targets child
          on child.relid = fk.conrelid
         and child.deleted = false
        where fk.contype = 'f'
          and fk.confrelid = t.relid
          and fk.conrelid <> fk.confrelid
      )
    order by t.table_name
    limit 1;

    if candidate.table_name is not null then
      raise notice 'Deleting test data from public.%', candidate.table_name;

      -- Deliberately no CASCADE. Internal FK triggers remain enabled.
      execute format('delete from public.%I', candidate.table_name);

      update _op_reset_targets
      set deleted = true
      where table_name = candidate.table_name;

      continue;
    end if;

    -- No deletable node means the remaining target graph contains a cycle.
    -- Find one FK edge whose CHILD columns are all nullable, clear it, and retry.
    breakable_fk := null;
    set_clause := null;

    select
      fk.oid as fk_oid,
      fk.conname as fk_name,
      child.table_name as child_table,
      parent.table_name as parent_table,
      string_agg(format('%I = null', a.attname), ', ' order by k.ord) as set_clause
    into breakable_fk
    from pg_constraint fk
    join _op_reset_targets child
      on child.relid = fk.conrelid
     and child.deleted = false
    join _op_reset_targets parent
      on parent.relid = fk.confrelid
     and parent.deleted = false
    join lateral unnest(fk.conkey) with ordinality as k(attnum, ord)
      on true
    join pg_attribute a
      on a.attrelid = fk.conrelid
     and a.attnum = k.attnum
    where fk.contype = 'f'
      and fk.conrelid <> fk.confrelid
    group by fk.oid, fk.conname, child.table_name, parent.table_name
    having bool_and(a.attnotnull = false)
    order by child.table_name, parent.table_name, fk.conname
    limit 1;

    if breakable_fk.fk_oid is null then
      raise notice 'Unable to break the remaining FK cycle safely. Remaining target tables:';
      for blocker in
        select table_name from _op_reset_targets where deleted = false order by table_name
      loop
        raise notice '  %', blocker.table_name;
      end loop;

      raise notice 'Remaining target-to-target foreign keys:';
      for blocker in
        select
          child.table_name as child_table,
          fk.conname as fk_name,
          parent.table_name as parent_table
        from pg_constraint fk
        join _op_reset_targets child
          on child.relid = fk.conrelid
         and child.deleted = false
        join _op_reset_targets parent
          on parent.relid = fk.confrelid
         and parent.deleted = false
        where fk.contype = 'f'
          and fk.conrelid <> fk.confrelid
        order by child.table_name, parent.table_name, fk.conname
      loop
        raise notice '  %.% -> %', blocker.child_table, blocker.fk_name, blocker.parent_table;
      end loop;

      raise exception 'Reset stopped because the remaining foreign-key cycle contains no safely nullable edge. No data was committed.';
    end if;

    set_clause := breakable_fk.set_clause;

    raise notice 'Breaking temporary nullable lineage FK %: %. -> %',
      breakable_fk.fk_name,
      breakable_fk.child_table,
      breakable_fk.parent_table;

    execute format(
      'update public.%I set %s where %s',
      breakable_fk.child_table,
      set_clause,
      replace(set_clause, ' = null', ' is not null')
    );

    -- Retry dependency resolution after removing this nullable edge from the data.
    -- The FK constraint itself remains installed and active throughout.
  end loop;
end $$;

-- Re-enable all application/business triggers BEFORE verification/commit.
do $$
declare
  r record;
begin
  for r in select table_name from _op_reset_targets order by table_name loop
    raise notice 'Re-enabling USER triggers on public.%', r.table_name;
    execute format('alter table public.%I enable trigger user', r.table_name);
  end loop;
end $$;

-- Capture and verify after counts.
do $$
declare
  r record;
  c bigint;
begin
  for r in select table_name from _op_reset_targets order by table_name loop
    execute format('select count(*) from public.%I', r.table_name) into c;
    insert into _op_reset_counts_after(table_name, row_count) values (r.table_name, c);
    if c <> 0 then
      raise exception 'Reset verification failed: public.% still contains % row(s).', r.table_name, c;
    end if;
  end loop;
end $$;

-- Human-readable reset report.
select
  b.table_name,
  b.row_count as rows_before,
  a.row_count as rows_after,
  b.row_count - a.row_count as rows_deleted
from _op_reset_counts_before b
join _op_reset_counts_after a using (table_name)
order by b.table_name;

-- Intentionally preserved platform/configuration data:
-- auth.users
-- profiles
-- organisations
-- organisation_members / memberships
-- roles / permissions
-- partners
-- companies
-- contacts
-- document_templates / document configuration
-- notification_templates
-- application/system/reference settings
-- database functions, RLS, triggers and migrations

commit;

-- OPTIONAL SECOND CLEANUP
-- If companies, contacts or partners are ALSO entirely dummy, handle them only
-- after the main reset succeeds and after checking there are no real records.
-- Do not add them to the transactional reset blindly.
