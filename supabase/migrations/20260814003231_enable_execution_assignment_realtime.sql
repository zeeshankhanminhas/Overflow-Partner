do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='project_execution_assignments') then
    execute 'alter publication supabase_realtime add table public.project_execution_assignments';
  end if;
end $$;
