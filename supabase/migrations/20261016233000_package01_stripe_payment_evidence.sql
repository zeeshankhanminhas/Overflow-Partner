-- Package 01: immutable provider evidence; does not change live release RPCs.
create table if not exists public.quote_stripe_payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  quote_id uuid not null references public.quotes(id),
  organisation_id uuid not null,
  quote_revision integer not null,
  amount_total bigint not null check(amount_total > 0),
  currency text not null,
  stripe_payment_status text not null check (stripe_payment_status = 'paid'),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists quote_stripe_payment_events_quote_idx on public.quote_stripe_payment_events(organisation_id, quote_id);
alter table public.quote_stripe_payment_events enable row level security;
-- Deliberately no browser-accessible policies. Only the trusted server webhook
-- can insert. Existing quote release functions remain unchanged.
