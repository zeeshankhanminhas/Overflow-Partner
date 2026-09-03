-- Project 360 release requires both written client acceptance and confirmed opening payment.
-- This is an evidence gate, not a replacement for the Project receivables ledger.

begin;

create table if not exists public.quote_payment_confirmations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'GBP',
  payment_method text not null check (payment_method in ('bank_transfer','card','other')),
  payment_reference text not null check (length(trim(payment_reference)) > 0),
  confirmed_at timestamptz not null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organisation_id, quote_id)
);

alter table public.quote_payment_confirmations enable row level security;

drop policy if exists quote_payment_confirmations_org_read on public.quote_payment_confirmations;
create policy quote_payment_confirmations_org_read
on public.quote_payment_confirmations for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organisation_id = quote_payment_confirmations.organisation_id
      and p.is_active = true
  )
);

revoke all on table public.quote_payment_confirmations from public, anon;
grant select on table public.quote_payment_confirmations to authenticated;
grant all on table public.quote_payment_confirmations to service_role;

create index if not exists ix_quote_payment_confirmations_lead
  on public.quote_payment_confirmations (organisation_id, lead_id);

create or replace function public.op_guard_project_client_acceptance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quote_id is null then
    raise exception 'OS_INTEGRITY: Project 360 requires a governed accepted Client Quote.';
  end if;
  if not exists (
    select 1 from public.quote_acceptance_records a
    where a.organisation_id = new.organisation_id and a.quote_id = new.quote_id
  ) then
    raise exception 'OS_INTEGRITY: Project 360 requires recorded written client acceptance evidence.';
  end if;
  if not exists (
    select 1 from public.quote_payment_confirmations p
    where p.organisation_id = new.organisation_id and p.quote_id = new.quote_id
  ) then
    raise exception 'OS_INTEGRITY: Project 360 requires confirmed opening payment evidence.';
  end if;
  return new;
end;
$$;

revoke all on function public.op_guard_project_client_acceptance() from public, anon, authenticated;
grant execute on function public.op_guard_project_client_acceptance() to service_role;

revoke all on function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text)
  to service_role;

create or replace function public.op_accept_quote_create_project_with_payment_confirmation(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_acceptance_basis text,
  p_evidence_reference text,
  p_accepted_by_name text,
  p_accepted_by_email text default null,
  p_notes text default null,
  p_payment_method text default null,
  p_payment_reference text default null,
  p_payment_confirmed_at timestamptz default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_project public.projects;
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,
    p_user_id,
    array['owner','admin','operator','commercial','business_development']
  );

  if p_payment_method not in ('bank_transfer','card','other') then
    raise exception 'Select a valid payment method.';
  end if;
  if nullif(trim(coalesce(p_payment_reference,'')), '') is null then
    raise exception 'Confirmed payment reference is required.';
  end if;
  if p_payment_confirmed_at is null then
    raise exception 'Payment confirmation date and time are required.';
  end if;
  if p_payment_confirmed_at > now() then
    raise exception 'Payment confirmation cannot be in the future.';
  end if;

  select * into v_quote
  from public.quotes
  where organisation_id = p_organisation_id and id = p_quote_id
  for update;
  if not found then raise exception 'Quote not found.'; end if;
  if v_quote.status::text <> 'issued' then raise exception 'Only an issued Quote can be released to Project 360.'; end if;
  if coalesce(v_quote.total,0) <= 0 then raise exception 'A positive Client Quote total is required before payment confirmation.'; end if;

  insert into public.quote_payment_confirmations (
    organisation_id, quote_id, lead_id, amount, currency, payment_method,
    payment_reference, confirmed_at, recorded_by
  ) values (
    p_organisation_id, v_quote.id, v_quote.lead_id, v_quote.total, v_quote.currency,
    p_payment_method, trim(p_payment_reference), p_payment_confirmed_at, p_user_id
  )
  on conflict (organisation_id, quote_id) do nothing;

  perform public.op_record_activity(
    p_organisation_id,
    p_user_id,
    'quote',
    v_quote.id,
    'client_payment_confirmed_for_project_release',
    jsonb_build_object(
      'paymentMethod', p_payment_method,
      'paymentReference', trim(p_payment_reference),
      'confirmedAt', p_payment_confirmed_at,
      'amount', v_quote.total,
      'currency', v_quote.currency,
      'invariant', 'ACCEPTANCE_AND_PAYMENT_BEFORE_PROJECT'
    )
  );

  v_project := public.op_accept_quote_create_project_with_acceptance_core(
    p_organisation_id,
    p_user_id,
    p_quote_id,
    p_acceptance_basis,
    p_evidence_reference,
    p_accepted_by_name,
    p_accepted_by_email,
    p_notes
  );

  perform public.op_record_activity(
    p_organisation_id,
    p_user_id,
    'project',
    v_project.id,
    'project_opening_payment_gate_satisfied',
    jsonb_build_object(
      'quoteId', p_quote_id,
      'paymentReference', trim(p_payment_reference),
      'canonicalLifecycle', true
    )
  );

  return v_project;
end;
$$;

revoke all on function public.op_accept_quote_create_project_with_payment_confirmation(uuid,uuid,uuid,text,text,text,text,text,text,text,timestamptz)
  from public, anon;
grant execute on function public.op_accept_quote_create_project_with_payment_confirmation(uuid,uuid,uuid,text,text,text,text,text,text,text,timestamptz)
  to authenticated, service_role;

commit;
