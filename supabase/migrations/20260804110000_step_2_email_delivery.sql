begin;

alter table public.intake_sessions
  add column if not exists recipient_email text,
  add column if not exists email_status text not null default 'pending'
    check (email_status in ('pending','sent','failed','not_configured')),
  add column if not exists email_message_id text,
  add column if not exists email_error text,
  add column if not exists last_email_attempt_at timestamptz;

create index if not exists ix_intake_sessions_email_status
  on public.intake_sessions (organisation_id, email_status, created_at desc);

commit;
