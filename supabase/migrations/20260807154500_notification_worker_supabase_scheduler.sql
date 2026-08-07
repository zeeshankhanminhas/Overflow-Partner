begin;

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create or replace function public.op_run_notification_worker()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  app_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
    into app_url
  from vault.decrypted_secrets
  where name = 'overflow_partner_app_url'
  order by created_at desc
  limit 1;

  select decrypted_secret
    into cron_secret
  from vault.decrypted_secrets
  where name = 'overflow_partner_cron_secret'
  order by created_at desc
  limit 1;

  if coalesce(trim(app_url), '') = '' then
    raise exception 'Supabase Vault secret overflow_partner_app_url is not configured';
  end if;

  if coalesce(trim(cron_secret), '') = '' then
    raise exception 'Supabase Vault secret overflow_partner_cron_secret is not configured';
  end if;

  app_url := regexp_replace(app_url, '/+$', '');

  select net.http_post(
    url := app_url || '/api/notifications/process',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json',
      'User-Agent', 'Overflow-Partner-Supabase-Scheduler/1.0'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into request_id;

  return request_id;
end;
$$;

revoke all on function public.op_run_notification_worker() from public;
revoke all on function public.op_run_notification_worker() from anon;
revoke all on function public.op_run_notification_worker() from authenticated;
grant execute on function public.op_run_notification_worker() to service_role;

-- Replace any previous version of this named job so repeated migration runs remain safe.
do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'overflow-partner-notification-worker-hourly'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

select cron.schedule(
  'overflow-partner-notification-worker-hourly',
  '0 * * * *',
  $$select public.op_run_notification_worker();$$
);

commit;
