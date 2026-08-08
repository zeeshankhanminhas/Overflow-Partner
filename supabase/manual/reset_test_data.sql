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
-- 7. Neutralised nullable FK edges are tracked so the sorter can continue.
-- 8. Non-nullable FK cycles still abort the reset.
-- 9. Temporarily disables USER/business triggers only while deleting test data.
--    PostgreSQL internal FK constraint triggers remain enabled.
-- 10. USER/business triggers are re-enabled before commit.
--
-- Run this entire file in the Supabase SQL Editor.

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
  deleted boolean not null default false
) on commit drop;

create temporary table _op_reset_ignored_fks (
  fk_oid oid primary key,
  fk_name text not null,
  child_table text not null,
  parent_table text not null
) on commit drop;

do $$
declare
  t text;
  targets text[] := array[
    'notification_deliveries','notification_queue','notifications','communication_events','communications',
    'document_signatures','document_approvals','document_reviews','document_versions','document_files','documents',
    'partner_review_internal_decisions','partner_review_responses','partner_review_files','partner_review_requests',
    'partner_quotes','commercial_reviews','quotes',
    'partner_payments','payments','partner_payables','invoices','billing_milestones','commercial_terms',
    'project_stage_events','project_stage_history','project_activities','activity_events','tasks','risk_register',
    'compliance_register','projects','technical_intakes','leads','prospect_technical_reviews','intake_sessions','prospects'
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

-- Disable only application/business triggers. FK constraint triggers stay active.
do $$
declare
  r record;
begin
  for r in select table_name from _op_reset_targets order by table_name loop
    execute format('alter table public.%I disable trigger user', r.table_name);
  end loop;
end $$;

-- Dependency-aware deletion with nullable-cycle breaking.
do $$
declare
  candidate record;
  remaining_count integer;
  blocker record;
  breakable_fk record;
  set_clause text;
  where_clause text;
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
        left join _op_reset_ignored_fks ignored
          on ignored.fk_oid = fk.oid
        where fk.contype = 'f'
          and fk.confrelid = t.relid
          and fk.conrelid <> fk.confrelid
          and ignored.fk_oid is null
      )
    order by t.table_name
    limit 1;

    if candidate.table_name is not null then
      raise notice 'Deleting test data from public.%', candidate.table_name;
      execute format('delete from public.%I', candidate.table_name);
      update _op_reset_targets set deleted = true where table_name = candidate.table_name;
      continue;
    end if;

    breakable_fk := null;

    select
      fk.oid as fk_oid,
      fk.conname as fk_name,
      child.table_name as child_table,
      parent.table_name as parent_table,
      string_agg(format('%I = null', a.attname), ', ' order by k.ord) as set_clause,
      string_agg(format('%I is not null', a.attname), ' or ' order by k.ord) as where_clause
    into breakable_fk
    from pg_constraint fk
    join _op_reset_targets child
      on child.relid = fk.conrelid
     and child.deleted = false
    join _op_reset_targets parent
      on parent.relid = fk.confrelid
     and parent.deleted = false
    left join _op_reset_ignored_fks ignored
      on ignored.fk_oid = fk.oid
    join lateral unnest(fk.conkey) with ordinality as k(attnum, ord)
      on true
    join pg_attribute a
      on a.attrelid = fk.conrelid
     and a.attnum = k.attnum
    where fk.contype = 'f'
      and fk.conrelid <> fk.confrelid
      and ignored.fk_oid is null
    group by fk.oid, fk.conname, child.table_name, parent.table_name
    having bool_and(a.attnotnull = false)
    order by child.table_name, parent_table, fk.conname
    limit 1;

    if breakable_fk.fk_oid is null then
      raise notice 'Unable to break the remaining FK cycle safely. Remaining target tables:';
      for blocker in
        select table_name from _op_reset_targets where deleted = false order by table_name
      loop
        raise notice '  %', blocker.table_name;
      end loop;

      raise notice 'Remaining active target-to-target foreign keys:';
      for blocker in
        select child.table_name as child_table,
               fk.conname as fk_name,
               parent.table_name as parent_table
        from pg_constraint fk
        join _op_reset_targets child
          on child.relid = fk.conrelid and child.deleted = false
        join _op_reset_targets parent
          on parent.relid = fk.confrelid and parent.deleted = false
        left join _op_reset_ignored_fks ignored
          on ignored.fk_oid = fk.oid
        where fk.contype = 'f'
          and fk.conrelid <> fk.confrelid
          and ignored.fk_oid is null
        order by child.table_name, parent.table_name, fk.conname
      loop
        raise notice '  %.% -> %', blocker.child_table, blocker.fk_name, blocker.parent_table;
      end loop;

      raise exception 'Reset stopped because the remaining foreign-key cycle contains no safely nullable edge. No data was committed.';
    end if;

    set_clause := breakable_fk.set_clause;
    where_clause := breakable_fk.where_clause;

    raise notice 'Neutralising nullable FK %: % -> %',
      breakable_fk.fk_name,
      breakable_fk.child_table,
      breakable_fk.parent_table;

    execute format(
      'update public.%I set %s where %s',
      breakable_fk.child_table,
      set_clause,
      where_clause
    );

    insert into _op_reset_ignored_fks(fk_oid, fk_name, child_table, parent_table)
    values (
      breakable_fk.fk_oid,
      breakable_fk.fk_name,
      breakable_fk.child_table,
      breakable_fk.parent_table
    )
    on conflict (fk_oid) do nothing;
  end loop;
end $$;

-- Re-enable application/business triggers before verification and commit.
do $$
declare
  r record;
begin
  for r in select table_name from _op_reset_targets order by table_name loop
    execute format('alter table public.%I enable trigger user', r.table_name);
  end loop;
end $$;

-- Verify every targeted transactional table is empty.
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

select
  b.table_name,
  b.row_count as rows_before,
  a.row_count as rows_after,
  b.row_count - a.row_count as rows_deleted
from _op_reset_counts_before b
join _op_reset_counts_after a using (table_name)
order by b.table_name;

commit;

-- PRESERVED: auth.users, profiles, organisations, memberships, roles/permissions,
-- partners, companies, contacts, templates/configuration, reference data,
-- functions, triggers, RLS and migration/schema definitions.
