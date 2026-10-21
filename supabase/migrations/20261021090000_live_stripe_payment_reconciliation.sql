-- Mode provenance is stored with each signed Checkout event and is immutable
-- through the existing unique Stripe event and session constraints.
alter table public.quote_stripe_payment_events
  add column if not exists livemode boolean not null default false;

-- Production-only opening payment reconciliation.
-- Apply ONLY after test migrations pass and a controlled production backup/approval.
-- A signed live Stripe webhook must persist an immutable live event first.
create or replace function public.op_finalize_live_stripe_quote_payment(p_session_id text)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.quote_stripe_payment_events%rowtype;
  v_quote public.quotes%rowtype;
  v_contract public.quote_release_contracts%rowtype;
  v_issue public.quote_issue_records%rowtype;
  v_project public.projects%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted payment service can reconcile live funds.';
  end if;
  if left(coalesce(p_session_id,''),8)<>'cs_live_' then
    raise exception 'Live Stripe Checkout session required.';
  end if;
  if nullif(trim(coalesce(p_session_id,'')),'') is null then
    raise exception 'Stripe session is required.';
  end if;

  select * into v_event from public.quote_stripe_payment_events
  where stripe_session_id=p_session_id and stripe_payment_status='paid';
  if not found then raise exception 'Verified paid Stripe event not found.'; end if;
  if v_event.livemode is distinct from true then
    raise exception 'A test-mode event can never create a live commercial project.';
  end if;

  select * into v_quote from public.quotes
  where id=v_event.quote_id and organisation_id=v_event.organisation_id
  for update;
  if not found then raise exception 'Quotation no longer exists.'; end if;
  if v_quote.revision is distinct from v_event.quote_revision
     or upper(trim(v_quote.currency)) is distinct from upper(trim(v_event.currency)) then
    raise exception 'Stripe event does not match the current quotation revision and currency.';
  end if;
  select * into v_contract from public.quote_release_contracts
    where quote_id=v_quote.id and quote_revision=v_quote.revision and organisation_id=v_quote.organisation_id;
  if not found or v_contract.release_basis not in ('payment','deposit') then
    raise exception 'Frozen accepted quote payment terms are missing or incompatible.';
  end if;
  if v_contract.opening_amount <= 0 or v_contract.opening_amount > v_quote.total
    or (v_contract.release_basis='deposit' and
         v_contract.opening_amount <> round(v_quote.total*0.30,2))
    or (v_contract.release_basis='payment' and v_contract.opening_amount <> v_quote.total)
    or round(v_contract.opening_amount*100)::bigint is distinct from v_event.amount_total then
    raise exception 'Stripe payment evidence must exactly equal the frozen opening payment.';
  end if;
  -- Live funds are not subject to the QA-only sandbox allowlist. The verified
  -- webhook stores the event with livemode=true, and this routine checks that
  -- evidence, frozen quote revision, signatory and exact opening amount.
  if not exists (
    select 1 from public.quote_stripe_payment_events e
    where e.id=v_event.id and e.stripe_payment_status='paid'
  ) then raise exception 'No verified Stripe payment evidence.'; end if;

  select * into v_issue from public.quote_issue_records
  where quote_id=v_quote.id and organisation_id=v_quote.organisation_id
    and quote_revision=v_quote.revision and client_response='accepted'
    and client_response_at is not null
  order by issued_at desc limit 1;
  if not found then raise exception 'Client has not accepted the current quotation.'; end if;

  -- Idempotent replay after successful project creation. Never write a second receipt.
  select * into v_project from public.projects
  where quote_id=v_quote.id and organisation_id=v_quote.organisation_id limit 1;
  if found then
    if not exists (
      select 1 from public.quote_payment_confirmations p
      where p.quote_id=v_quote.id and p.organisation_id=v_quote.organisation_id
        and p.payment_method='stripe' and p.payment_reference=v_event.stripe_session_id
    ) then raise exception 'Existing project has different release/payment evidence.'; end if;
    return v_project;
  end if;

  if v_quote.status::text <> 'issued' then
    raise exception 'Quotation is not in an issuable commercial state.';
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    raise exception 'Quotation has expired; project release requires a revised accepted quotation.';
  end if;
  if exists (select 1 from public.quote_release_confirmations
             where quote_id=v_quote.id and organisation_id=v_quote.organisation_id) then
    raise exception 'Quotation already has a non-payment commercial release.';
  end if;
  if exists (select 1 from public.quote_payment_confirmations
             where quote_id=v_quote.id and organisation_id=v_quote.organisation_id) then
    raise exception 'Quotation already has different opening payment confirmation.';
  end if;
  -- Release actor is the OP team member who issued the quote, not the anonymous client.
  -- Existing RPC rechecks workspace role and applies its existing project uniqueness controls.
  insert into public.quote_payment_confirmations (
    organisation_id, quote_id, lead_id, amount, currency, payment_method,
    payment_reference, confirmed_at, recorded_by
  ) values (
    v_quote.organisation_id, v_quote.id, v_quote.lead_id, v_contract.opening_amount,
    v_quote.currency, 'stripe', v_event.stripe_session_id, v_event.verified_at,
    v_issue.recorded_by
  );
  v_project := public.op_accept_quote_create_project_with_acceptance_core(
    v_quote.organisation_id, v_issue.recorded_by, v_quote.id,
    'client_portal',
    'Client portal acceptance of quote revision '||v_quote.revision||' at '||v_issue.client_response_at,
    coalesce(nullif(v_issue.recipient_name,''),'Client via secure quotation link'),
    v_issue.recipient_email,
    'Verified Stripe settlement, session '||v_event.stripe_session_id
  );
  perform public.op_record_activity(
    v_quote.organisation_id, v_issue.recorded_by, 'project', v_project.id,
    'project_opening_payment_gate_satisfied',
    jsonb_build_object('quoteId', v_quote.id, 'paymentMethod', 'stripe',
      'paymentReference', v_event.stripe_session_id, 'source','signed_live_stripe_webhook')
  );
  return v_project;
end;
$$;
revoke all on function public.op_finalize_live_stripe_quote_payment(text) from public, anon, authenticated;
grant execute on function public.op_finalize_live_stripe_quote_payment(text) to service_role;

-- The existing final-settlement RPC remains the reviewed common transaction.
-- A separate service-only entrypoint ensures production cannot consume QA events.
create or replace function public.op_record_live_stripe_final_settlement(
  p_project_id uuid,p_session_id text
) returns public.op_project_final_settlements
language plpgsql security definer set search_path=public as $$
declare
  v_event public.quote_stripe_payment_events%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the trusted payment service can reconcile live funds.';
  end if;
  if left(coalesce(p_session_id,''),8)<>'cs_live_' then
    raise exception 'Live Stripe Checkout session required.';
  end if;
  select * into v_event from public.quote_stripe_payment_events
    where stripe_session_id=p_session_id and stripe_payment_status='paid';
  if not found or v_event.livemode is distinct from true then
    raise exception 'Verified live Stripe payment is missing.';
  end if;
  return public.op_record_verified_project_final_settlement(p_project_id,p_session_id);
end;
$$;
revoke all on function public.op_record_live_stripe_final_settlement(uuid,text)
  from public,anon,authenticated;
grant execute on function public.op_record_live_stripe_final_settlement(uuid,text)
  to service_role;
