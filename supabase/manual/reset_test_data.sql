-- Overflow Partner — controlled test-data reset
-- Purpose: remove transactional / dummy business data without dropping schema,
-- auth users, profiles, organisations, roles, permissions, partners, companies,
-- contacts, configuration, RLS, functions, triggers, or migrations.
--
-- SAFETY MODEL
-- 1. Runs in one transaction.
-- 2. Deletes children before parents.
-- 3. Does NOT use CASCADE.
-- 4. Missing optional tables are skipped.
-- 5. Any unexpected FK/dependency error aborts the transaction.
--
-- Run this entire file in the Supabase SQL Editor.

begin;

-- Explicit operator acknowledgement. Remove/change this value and the reset aborts.
select set_config('op.test_reset_confirmation', 'RESET_OVERFLOW_PARTNER_TEST_DATA', true);

do $$
begin
  if current_setting('op.test_reset_confirmation', true) <> 'RESET_OVERFLOW_PARTNER_TEST_DATA' then
    raise exception 'Reset confirmation missing. No data was deleted.';
  end if;
end $$;

-- Capture before counts for every target table that exists.
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
  t text;
  c bigint;
  targets text[] := array[
    -- Notifications / communications / audit children
    'notification_deliveries',
    'notification_queue',
    'notifications',
    'communication_events',
    'communications',

    -- Document children / signatures / revisions
    'document_signatures',
    'document_approvals',
    'document_reviews',
    'document_versions',
    'document_files',

    -- Partner review children
    'partner_review_internal_decisions',
    'partner_review_responses',
    'partner_review_files',

    -- Finance children
    'partner_payments',
    'payments',

    -- Project / workflow children
    'project_stage_events',
    'project_stage_history',
    'project_activities',
    'activity_events',
    'tasks',
    'risk_register',

    -- Commercial / controlled business records
    'partner_payables',
    'invoices',
    'commercial_terms',
    'documents',
    'partner_review_requests',
    'quotes',
    'commercial_reviews',
    'partner_quotes',
    'technical_intakes',
    'projects',

    -- Acquisition children and parents
    'prospect_technical_reviews',
    'intake_sessions',
    'leads',
    'prospects'
  ];
begin
  foreach t in array targets loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('select count(*) from public.%I', t) into c;
      insert into _op_reset_counts_before(table_name, row_count)
      values (t, c)
      on conflict (table_name) do update set row_count = excluded.row_count;
    end if;
  end loop;
end $$;

-- Delete known transactional tables in FK-safe order.
-- If an unanticipated preserved table references one of these rows, PostgreSQL
-- will stop here and the transaction will roll back rather than cascade.
do $$
declare
  t text;
  targets text[] := array[
    'notification_deliveries',
    'notification_queue',
    'notifications',
    'communication_events',
    'communications',

    'document_signatures',
    'document_approvals',
    'document_reviews',
    'document_versions',
    'document_files',

    'partner_review_internal_decisions',
    'partner_review_responses',
    'partner_review_files',

    'partner_payments',
    'payments',

    'project_stage_events',
    'project_stage_history',
    'project_activities',
    'activity_events',
    'tasks',
    'risk_register',

    'partner_payables',
    'invoices',
    'commercial_terms',
    'documents',
    'partner_review_requests',
    'quotes',
    'commercial_reviews',
    'partner_quotes',
    'technical_intakes',
    'projects',

    'prospect_technical_reviews',
    'intake_sessions',
    'leads',
    'prospects'
  ];
begin
  foreach t in array targets loop
    if to_regclass(format('public.%I', t)) is not null then
      raise notice 'Deleting test data from public.%', t;
      execute format('delete from public.%I', t);
    end if;
  end loop;
end $$;

-- Capture / verify after counts.
do $$
declare
  t text;
  c bigint;
begin
  for t in select table_name from _op_reset_counts_before order by table_name loop
    execute format('select count(*) from public.%I', t) into c;
    insert into _op_reset_counts_after(table_name, row_count) values (t, c);
    if c <> 0 then
      raise exception 'Reset verification failed: public.% still contains % row(s).', t, c;
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

-- Sanity check: these platform/configuration tables are intentionally NOT touched.
-- profiles
-- organisations
-- organisation_members / memberships
-- auth.users
-- roles / permissions
-- partners
-- companies
-- contacts
-- document_templates / document configuration
-- notification_templates
-- system/settings/reference tables

commit;

-- OPTIONAL SECOND CLEANUP
-- If companies, contacts, or partners are ALSO entirely dummy, clean them only
-- after the main reset succeeds and after confirming there are no real records.
-- Do NOT uncomment blindly.
--
-- begin;
-- delete from public.contacts;
-- delete from public.companies;
-- delete from public.partners;
-- commit;
