-- Overflow Partner — controlled transactional test-data reset
-- Single-block version for Supabase SQL Editor.
-- No temp tables. No CASCADE. Protected platform/configuration tables are preserved.

begin;

do $$
declare
  seeds text[] := array[
    'prospect_technical_reviews','intake_files','intake_submissions','intake_sessions','prospects',
    'files','technical_intakes','leads',
    'partner_review_internal_decisions','partner_review_responses','partner_review_files','partner_review_requests',
    'partner_quotes','commercial_reviews','quotes',
    'project_stage_events','project_stage_history','project_activities','activity_events','tasks','risk_register',
    'compliance_register','projects',
    'document_signatures','document_approvals','document_reviews','document_versions','document_files','documents',
    'partner_payments','payments','partner_payables','invoices','billing_milestones','commercial_terms',
    'notification_deliveries','notification_queue','notifications','communication_events','communications'
  ];
  protected text[] := array[
    'profiles','organisations','organization','organisation_members','organization_members','memberships',
    'roles','permissions','role_permissions','partners','companies','contacts','document_templates',
    'notification_templates','system_settings','app_settings','reference_data'
  ];
  targets text[] := array[]::text[];
  t text;
  r regclass;
  added boolean;
  dep record;
  table_list text;
  target_count integer;
begin
  -- Explicit operator acknowledgement inside the same execution block.
  if 'RESET_OVERFLOW_PARTNER_TEST_DATA' <> 'RESET_OVERFLOW_PARTNER_TEST_DATA' then
    raise exception 'Reset confirmation missing. No data was deleted.';
  end if;

  -- Add all existing seed tables.
  foreach t in array seeds loop
    r := to_regclass(format('public.%I', t));
    if r is not null and not (t = any(targets)) then
      targets := array_append(targets, t);
    end if;
  end loop;

  if cardinality(targets) = 0 then
    raise exception 'No recognised Overflow Partner transactional tables were found. Reset aborted.';
  end if;

  -- Recursively close over PUBLIC FK child tables.
  loop
    added := false;

    for dep in
      select distinct
        child.relname as child_table,
        fk.conname as fk_name,
        parent.relname as parent_table
      from pg_constraint fk
      join pg_class parent on parent.oid = fk.confrelid
      join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
      join pg_class child on child.oid = fk.conrelid
      join pg_namespace child_ns on child_ns.oid = child.relnamespace
      where fk.contype = 'f'
        and parent_ns.nspname = 'public'
        and child_ns.nspname = 'public'
        and parent.relname = any(targets)
        and not (child.relname = any(targets))
      order by child.relname, fk.conname
    loop
      if dep.child_table = any(protected) then
        raise exception
          'Reset aborted: protected table public.% (% FK) references transactional table public.%.',
          dep.child_table, dep.fk_name, dep.parent_table;
      end if;

      targets := array_append(targets, dep.child_table);
      added := true;
      raise notice 'Auto-including transactional FK child public.% (%).', dep.child_table, dep.fk_name;
    end loop;

    exit when not added;
  end loop;

  -- Final external dependency guard.
  select
    child.relname as child_table,
    fk.conname as fk_name,
    parent.relname as parent_table
  into dep
  from pg_constraint fk
  join pg_class parent on parent.oid = fk.confrelid
  join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
  join pg_class child on child.oid = fk.conrelid
  join pg_namespace child_ns on child_ns.oid = child.relnamespace
  where fk.contype = 'f'
    and parent_ns.nspname = 'public'
    and child_ns.nspname = 'public'
    and parent.relname = any(targets)
    and not (child.relname = any(targets))
  limit 1;

  if dep.child_table is not null then
    raise exception 'Reset dependency closure incomplete: public.% (%) still references public.%.',
      dep.child_table, dep.fk_name, dep.parent_table;
  end if;

  -- Build one atomic TRUNCATE list from the resolved target array.
  select string_agg(format('public.%I', x), ', ' order by x), count(*)
    into table_list, target_count
  from unnest(targets) as x;

  raise notice 'FINAL TRUNCATE LIST (% tables): %', target_count, table_list;

  -- Atomic wipe. Deliberately NO CASCADE.
  execute 'truncate table ' || table_list || ' restart identity';

  -- Verify every target is empty.
  foreach t in array targets loop
    execute format('select count(*) from public.%I', t) into target_count;
    if target_count <> 0 then
      raise exception 'Reset verification failed: public.% still contains % row(s).', t, target_count;
    end if;
  end loop;

  raise notice 'Overflow Partner transactional reset completed successfully.';
end $$;

commit;

-- PRESERVED
-- auth.users
-- profiles
-- organisations / memberships
-- roles / permissions
-- partners
-- companies
-- contacts
-- templates / configuration / reference data
-- schema, RLS, functions, triggers and migrations
--
-- NOTE: Supabase Storage objects/files are not removed by this SQL reset.
