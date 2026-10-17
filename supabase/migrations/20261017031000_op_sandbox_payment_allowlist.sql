-- Explicit allowlist for Stripe Sandbox on shared OPOS database.
-- Empty by default. Only service_role may manage it; never expose browser policies.
create table if not exists public.op_sandbox_payment_authorisations (
  quote_id uuid primary key references public.quotes(id) on delete cascade,
  organisation_id uuid not null,
  quote_revision integer not null,
  authorised_at timestamptz not null default now(),
  expires_at timestamptz not null,
  note text not null check (length(trim(note)) > 0),
  check (expires_at > authorised_at)
);
alter table public.op_sandbox_payment_authorisations enable row level security;
revoke all on public.op_sandbox_payment_authorisations from public, anon, authenticated;
grant select, insert, update, delete on public.op_sandbox_payment_authorisations to service_role;
-- The already-installed service-role finalizer must be replaced to consume this
-- allowlist before OP_PACKAGE01_AUTO_RELEASE_ENABLED may be switched on.
