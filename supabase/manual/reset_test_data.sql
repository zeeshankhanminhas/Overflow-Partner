-- Overflow Partner — controlled transactional test-data reset
--
-- Purpose
-- Remove dummy/transactional business records while preserving the platform:
-- auth users, profiles, organisations, memberships, roles/permissions, partners,
-- companies, contacts, templates/configuration, RLS, functions, triggers and schema.
--
-- WHY TRUNCATE
-- All targeted business tables are being emptied together. PostgreSQL permits
-- mutually-referencing FK tables to be truncated in one statement, which avoids
-- delete-order/cycle problems and does not invoke row-level DELETE business triggers.
--
-- SAFETY
-- 1. Runs in one transaction.
-- 2. NO CASCADE is used.
-- 3. Only the explicit allow-list below can be truncated.
-- 4. Missing optional tables are skipped.
-- 5. If any preserved/non-target table has an FK to a target table, PostgreSQL
--    refuses the TRUNCATE and the transaction rolls back.
-- 6. Platform/configuration tables are intentionally absent from the allow-list.
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

-- Known transactional tables only.
create temporary table _op_reset_targets (
  ordinal integer primary key,
  table_name text not null unique,
  relid oid not null unique
) on commit drop;

do $$
declare
  t text;
  i integer := 0;
  r regclass;
  targets text[] := array[
    -- Acquisition / case lifecycle
    'prospect_technical_reviews',
    'intake_files',
    'intake_submissions',
    'intake_sessions',
    'prospects',
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

    -- Documents / controlled evidence
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
  foreach t in array targets loop
    r := to_regclass(format('public.%I', t));
    if r is not null then
      i := i + 1;
      insert into _op_reset_targets(ordinal, table_name, relid)
      values (i, t, r::oid);
    end if;
  end loop;

  if i = 0 then
    raise exception 'No recognised Overflow Partner transactional tables were found. Reset aborted.';
  end if;
end $$;

-- Capture before counts for a human-readable report.
create temporary table _op_reset_counts_before (
  table_name text primary key,
  row_count bigint not null
) on commit drop;

do $$
declare
  r record;
  c bigint;
begin
  for r in select table_name from _op_reset_targets order by ordinal loop
    execute format('select count(*) from public.%I', r.table_name) into c;
    insert into _op_reset_counts_before(table_name, row_count)
    values (r.table_name, c);
  end loop;
end $$;

-- Pre-flight: report external FK dependencies. We do NOT automatically include
-- those tables, because they may be platform/configuration data that must survive.
do $$
declare
  dep record;
begin
  for dep in
    select distinct
      child_ns.nspname as child_schema,
      child.relname as child_table,
      fk.conname as fk_name,
      parent_target.table_name as target_table
    from pg_constraint fk
    join _op_reset_targets parent_target
      on parent_target.relid = fk.confrelid
    join pg_class child
      on child.oid = fk.conrelid
    join pg_namespace child_ns
      on child_ns.oid = child.relnamespace
    left join _op_reset_targets child_target
      on child_target.relid = fk.conrelid
    where fk.contype = 'f'
      and child_target.relid is null
      and child_ns.nspname = 'public'
    order by child_schema, child_table, fk_name
  loop
    raise notice 'External FK dependency: %.% (%) references transactional table %',
      dep.child_schema, dep.child_table, dep.fk_name, dep.target_table;
  end loop;
end $$;

-- Build ONE TRUNCATE statement containing every existing target table.
-- No CASCADE: an unexpected preserved-table FK makes PostgreSQL reject the whole
-- operation and this transaction rolls back.
do $$
declare
  table_list text;
begin
  select string_agg(format('public.%I', table_name), ', ' order by ordinal)
    into table_list
  from _op_reset_targets;

  if coalesce(table_list, '') = '' then
    raise exception 'Transactional reset table list is empty. Reset aborted.';
  end if;

  raise notice 'Truncating % transactional tables atomically.',
    (select count(*) from _op_reset_targets);

  execute 'truncate table ' || table_list || ' restart identity';
end $$;

-- Verify every target is empty before commit.
do $$
declare
  r record;
  c bigint;
begin
  for r in select table_name from _op_reset_targets order by ordinal loop
    execute format('select count(*) from public.%I', r.table_name) into c;
    if c <> 0 then
      raise exception 'Reset verification failed: public.% still contains % row(s).', r.table_name, c;
    end if;
  end loop;
end $$;

-- Human-readable report.
select
  t.table_name,
  b.row_count as rows_before,
  0::bigint as rows_after,
  b.row_count as rows_deleted
from _op_reset_targets t
join _op_reset_counts_before b using (table_name)
order by t.ordinal;

commit;

-- INTENTIONALLY PRESERVED
-- auth.users
-- public.profiles
-- organisations / memberships
-- roles / permissions
-- partners
-- companies
-- contacts
-- document templates / document configuration
-- notification templates
-- system/reference/configuration tables
-- storage/schema definitions
-- RLS policies, functions, triggers and migrations
--
-- Storage objects/files are NOT deleted by this SQL reset. If dummy uploaded files
-- exist in Supabase Storage, clean those separately after the database reset succeeds.
