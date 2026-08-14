do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='partner_progress_updates') then
    execute 'alter publication supabase_realtime add table public.partner_progress_updates';
  end if;
end $$;
