-- Conditional security hardening for older live installations.
-- Some clean migration-built databases do not contain this legacy table.
-- No table is created and no user-visible finance behavior is changed.
do $opos_guard$
begin
  if to_regclass('public.quote_payment_provider_events') is not null then
    execute 'alter table public.quote_payment_provider_events enable row level security';
    execute 'revoke all on public.quote_payment_provider_events from public,anon,authenticated';
    execute 'grant select,insert,update on public.quote_payment_provider_events to service_role';
  end if;
end
$opos_guard$;
