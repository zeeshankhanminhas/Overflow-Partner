begin;

create table if not exists public.quote_payment_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  quote_revision integer not null check (quote_revision > 0),
  attempt integer not null check (attempt > 0),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency = lower(currency)),
  status text not null default 'creating' check (status in ('creating','open','paid','failed','expired')),
  stripe_session_id text unique,
  stripe_livemode boolean,
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  payment_intent_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, quote_id, attempt)
);

create index if not exists ix_quote_payment_requests_quote
  on public.quote_payment_requests (organisation_id, quote_id, quote_revision, created_at desc);

alter table public.quote_payment_requests enable row level security;
create policy quote_payment_requests_org_read on public.quote_payment_requests for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=quote_payment_requests.organisation_id and p.is_active=true));
revoke all on public.quote_payment_requests from public, anon, authenticated;
grant select on public.quote_payment_requests to authenticated;
grant all on public.quote_payment_requests to service_role;

create table if not exists public.quote_payment_provider_confirmations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  quote_revision integer not null check (quote_revision > 0),
  provider text not null check (provider = 'stripe'),
  checkout_session_id text not null unique,
  payment_intent_id text not null unique,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  livemode boolean not null,
  paid_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, quote_id)
);

alter table public.quote_payment_provider_confirmations enable row level security;
create policy quote_payment_provider_confirmations_org_read on public.quote_payment_provider_confirmations for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=quote_payment_provider_confirmations.organisation_id and p.is_active=true));
revoke all on public.quote_payment_provider_confirmations from public, anon, authenticated;
grant select on public.quote_payment_provider_confirmations to authenticated;
grant all on public.quote_payment_provider_confirmations to service_role;

create table if not exists public.quote_payment_provider_events (
  provider_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
revoke all on public.quote_payment_provider_events from public, anon, authenticated;
grant all on public.quote_payment_provider_events to service_role;

create or replace function public.op_reserve_quote_payment_request(
  p_organisation_id uuid,
  p_quote_id uuid,
  p_quote_revision integer
)
returns public.quote_payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_issue public.quote_issue_records;
  v_terms text;
  v_request public.quote_payment_requests;
  v_attempt integer;
begin
  select * into v_quote from public.quotes
   where organisation_id=p_organisation_id and id=p_quote_id
   for update;
  if not found or v_quote.status::text <> 'issued' or v_quote.revision <> p_quote_revision then
    raise exception 'This issued quotation is no longer available for payment.';
  end if;
  if v_quote.total <= 0 then raise exception 'The quotation has no payable balance.'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    raise exception 'This quotation has expired.';
  end if;

  select * into v_issue from public.quote_issue_records
   where organisation_id=p_organisation_id and quote_id=p_quote_id and quote_revision=p_quote_revision
   for update;
  if not found or v_issue.client_response <> 'accepted' then
    raise exception 'Accept the quotation before starting payment.';
  end if;

  select pq.payment_terms into v_terms
    from public.commercial_reviews cr
    join public.partner_quotes pq on pq.id=cr.partner_quote_id and pq.organisation_id=cr.organisation_id
   where cr.organisation_id=p_organisation_id and cr.id=v_quote.commercial_review_id and cr.lead_id=v_quote.lead_id;
  if lower(coalesce(v_terms,'')) ~ '(no[[:space:]-]+(advance[[:space:]-]+)?payment(s)?[[:space:]-]+(is[[:space:]-]+)?(due|required|requested)|no[[:space:]-]+payment[[:space:]-]+is[[:space:]-]+(due|required|requested))' then
    raise exception 'The issued quotation does not require an advance payment.';
  end if;
  if exists(select 1 from public.projects p where p.organisation_id=p_organisation_id and p.quote_id=p_quote_id) then
    raise exception 'A project already exists for this quotation.';
  end if;
  if exists(select 1 from public.quote_payment_provider_confirmations p where p.organisation_id=p_organisation_id and p.quote_id=p_quote_id) then
    raise exception 'Payment is already confirmed for this quotation.';
  end if;

  select * into v_request from public.quote_payment_requests r
   where r.organisation_id=p_organisation_id and r.quote_id=p_quote_id and r.quote_revision=p_quote_revision
     and r.status in ('creating','open') and coalesce(r.expires_at,now()+interval '1 hour') > now()
   order by r.attempt desc limit 1 for update;
  if found then return v_request; end if;

  select coalesce(max(attempt),0)+1 into v_attempt from public.quote_payment_requests
   where organisation_id=p_organisation_id and quote_id=p_quote_id;
  insert into public.quote_payment_requests(organisation_id,quote_id,lead_id,quote_revision,attempt,amount,currency,status)
  values(p_organisation_id,p_quote_id,v_quote.lead_id,p_quote_revision,v_attempt,v_quote.total,lower(v_quote.currency),'creating')
  returning * into v_request;
  return v_request;
end;
$$;
revoke all on function public.op_reserve_quote_payment_request(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.op_reserve_quote_payment_request(uuid,uuid,integer) to service_role;

create or replace function public.op_record_stripe_quote_payment(
  p_provider_event_id text,
  p_event_type text,
  p_request_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_total bigint,
  p_currency text,
  p_livemode boolean,
  p_paid_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.quote_payment_requests;
  v_quote public.quotes;
  v_issue public.quote_issue_records;
begin
  select * into v_request from public.quote_payment_requests where id=p_request_id for update;
  if not found or v_request.stripe_session_id is distinct from p_checkout_session_id then
    raise exception 'The payment session does not match a recorded OP quote payment request.';
  end if;
  if v_request.status='paid' then
    if v_request.payment_intent_id=p_payment_intent_id then return false; end if;
    raise exception 'A different payment is already recorded for this request.';
  end if;
  if v_request.status not in ('open','creating') then raise exception 'This payment request is no longer payable.'; end if;
  if v_request.stripe_livemode is distinct from p_livemode then raise exception 'Stripe live/test mode does not match the issued payment request.'; end if;
  if p_amount_total <> round(v_request.amount*100)::bigint or lower(p_currency) <> v_request.currency then
    raise exception 'The confirmed amount or currency does not match the quotation.';
  end if;
  select * into v_quote from public.quotes where organisation_id=v_request.organisation_id and id=v_request.quote_id for update;
  if not found or v_quote.status::text <> 'issued' or v_quote.revision <> v_request.quote_revision or v_quote.total <> v_request.amount or lower(v_quote.currency) <> v_request.currency then
    raise exception 'The quote changed after the payment request was issued.';
  end if;
  select * into v_issue from public.quote_issue_records where organisation_id=v_request.organisation_id and quote_id=v_request.quote_id and quote_revision=v_request.quote_revision;
  if not found or v_issue.client_response <> 'accepted' then raise exception 'Client acceptance is required before payment can be released.'; end if;

  insert into public.quote_payment_provider_events(provider_event_id,event_type)
  values(p_provider_event_id,p_event_type) on conflict do nothing;
  if not found then return false; end if;

  insert into public.quote_payment_provider_confirmations(organisation_id,quote_id,lead_id,quote_revision,provider,checkout_session_id,payment_intent_id,amount,currency,livemode,paid_at)
  values(v_request.organisation_id,v_request.quote_id,v_request.lead_id,v_request.quote_revision,'stripe',p_checkout_session_id,p_payment_intent_id,v_request.amount,v_request.currency,p_livemode,p_paid_at)
  on conflict (organisation_id,quote_id) do nothing;
  if not exists(select 1 from public.quote_payment_provider_confirmations p where p.organisation_id=v_request.organisation_id and p.quote_id=v_request.quote_id and p.checkout_session_id=p_checkout_session_id and p.payment_intent_id=p_payment_intent_id and p.amount=v_request.amount and p.currency=v_request.currency) then
    raise exception 'A conflicting payment confirmation already exists for this quotation.';
  end if;
  update public.quote_payment_requests set status='paid',payment_intent_id=p_payment_intent_id,paid_at=p_paid_at,updated_at=now() where id=v_request.id;
  return true;
end;
$$;
revoke all on function public.op_record_stripe_quote_payment(text,text,uuid,text,text,bigint,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.op_record_stripe_quote_payment(text,text,uuid,text,text,bigint,text,boolean,timestamptz) to service_role;

create or replace function public.op_guard_card_payment_confirmation()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.payment_method='card' and not exists(
    select 1 from public.quote_payment_provider_confirmations p
    where p.organisation_id=new.organisation_id and p.quote_id=new.quote_id
      and p.payment_intent_id=trim(new.payment_reference) and p.amount=new.amount
      and p.currency=new.currency and p.provider='stripe'
  ) then
    raise exception 'OS_INTEGRITY: Card release requires a matching verified Stripe payment.';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_op_guard_card_payment_confirmation on public.quote_payment_confirmations;
create trigger trg_op_guard_card_payment_confirmation before insert or update on public.quote_payment_confirmations
for each row execute function public.op_guard_card_payment_confirmation();
revoke all on function public.op_guard_card_payment_confirmation() from public,anon,authenticated;
grant execute on function public.op_guard_card_payment_confirmation() to service_role;

create or replace function public.op_guard_project_client_acceptance()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.quote_id is null then raise exception 'OS_INTEGRITY: Project 360 requires a governed accepted Client Quote.'; end if;
  if not exists(select 1 from public.quote_acceptance_records a where a.organisation_id=new.organisation_id and a.quote_id=new.quote_id) then
    raise exception 'OS_INTEGRITY: Project 360 requires recorded written client acceptance evidence.';
  end if;
  if not exists(select 1 from public.quote_payment_confirmations p where p.organisation_id=new.organisation_id and p.quote_id=new.quote_id)
     and not exists(select 1 from public.quote_payment_provider_confirmations p where p.organisation_id=new.organisation_id and p.quote_id=new.quote_id)
     and not exists(select 1 from public.quote_release_confirmations r where r.organisation_id=new.organisation_id and r.quote_id=new.quote_id) then
    raise exception 'OS_INTEGRITY: Project 360 requires evidence that the issued quote release condition has been met.';
  end if;
  return new;
end;
$$;
revoke all on function public.op_guard_project_client_acceptance() from public, anon, authenticated;
grant execute on function public.op_guard_project_client_acceptance() to service_role;

commit;
