begin;

create unique index if not exists partner_quotes_one_per_review
  on public.partner_quotes(partner_review_request_id)
  where partner_review_request_id is not null;

create or replace function public.op_enforce_partner_quote_review() returns trigger
language plpgsql set search_path=public as $$
declare v_request public.partner_review_requests;
begin
  if new.partner_review_request_id is null then
    raise exception 'Partner review linkage is required for a commercial response';
  end if;

  select * into v_request
  from public.partner_review_requests
  where id=new.partner_review_request_id
    and organisation_id=new.organisation_id
    and lead_id=new.lead_id
    and partner_id=new.partner_id;

  if not found then
    raise exception 'Commercial response does not match the governed partner review';
  end if;

  if new.partner_review_response_id is null then
    select id into new.partner_review_response_id
    from public.partner_review_responses
    where partner_review_request_id=v_request.id
    order by revision desc limit 1;
  end if;

  if new.status='selected' and v_request.status not in ('approved','approved_with_conditions') then
    raise exception 'Commercial response cannot be selected until the technical partner review is internally approved';
  end if;

  return new;
end $$;

-- PostgreSQL cannot change an existing function return type with CREATE OR REPLACE.
-- Drop the earlier technical-only signature before recreating it with a JSONB
-- result containing both the technical and commercial records.
drop function if exists public.op_submit_partner_review_response(text, jsonb);

create function public.op_submit_partner_review_response(
  p_token_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_request public.partner_review_requests;
  v_response public.partner_review_responses;
  v_quote public.partner_quotes;
  v_revision integer;
  v_price numeric;
  v_currency text;
  v_valid_until date;
begin
  select * into v_request from public.partner_review_requests where token_hash=p_token_hash for update;
  if not found then raise exception 'Invalid review token'; end if;
  if v_request.status in ('approved','approved_with_conditions','rejected','revoked','expired') then raise exception 'Review is closed'; end if;
  if v_request.expires_at < now() then
    update public.partner_review_requests set status='expired',updated_at=now() where id=v_request.id;
    raise exception 'Review link has expired';
  end if;

  if (p_payload->>'feasibility') in ('feasible','feasible_with_conditions') then
    if nullif(p_payload->>'commercial_price','') is null then
      raise exception 'A commercial price is required for a feasible response';
    end if;
    if nullif(p_payload->>'commercial_currency','') is null then
      raise exception 'Commercial currency is required';
    end if;
  end if;

  select coalesce(max(revision),0)+1 into v_revision
  from public.partner_review_responses where partner_review_request_id=v_request.id;

  insert into public.partner_review_responses(
    organisation_id,partner_review_request_id,revision,feasibility,confidence_percent,
    capability_confirmed,software_capability,capacity_status,earliest_start_date,
    estimated_engineering_hours,estimated_lead_time_days,pricing_readiness,
    missing_information,assumptions,technical_risks,proposed_delivery_approach,
    exclusions,partner_notes,not_feasible_reason,declaration_checked,reviewer_name,reviewer_role
  ) values(
    v_request.organisation_id,v_request.id,v_revision,p_payload->>'feasibility',
    (p_payload->>'confidence_percent')::integer,(p_payload->>'capability_confirmed')::boolean,
    nullif(p_payload->>'software_capability',''),p_payload->>'capacity_status',
    nullif(p_payload->>'earliest_start_date','')::date,
    nullif(p_payload->>'estimated_engineering_hours','')::numeric,
    nullif(p_payload->>'estimated_lead_time_days','')::integer,
    p_payload->>'pricing_readiness',nullif(p_payload->>'missing_information',''),
    nullif(p_payload->>'assumptions',''),nullif(p_payload->>'technical_risks',''),
    nullif(p_payload->>'proposed_delivery_approach',''),nullif(p_payload->>'exclusions',''),
    nullif(p_payload->>'partner_notes',''),nullif(p_payload->>'not_feasible_reason',''),
    (p_payload->>'declaration_checked')::boolean,p_payload->>'reviewer_name',
    nullif(p_payload->>'reviewer_role','')
  ) returning * into v_response;

  if nullif(p_payload->>'commercial_price','') is not null then
    v_price := (p_payload->>'commercial_price')::numeric;
    v_currency := upper(p_payload->>'commercial_currency');
    v_valid_until := nullif(p_payload->>'commercial_valid_until','')::date;

    insert into public.partner_quotes(
      organisation_id,created_by,partner_id,lead_id,technical_intake_id,
      partner_review_request_id,partner_review_response_id,price,currency,
      lead_time_days,valid_until,status,notes,commercial_assumptions,exclusions,
      payment_terms,delivery_commitment,quote_reference,submitted_at
    ) values(
      v_request.organisation_id,v_request.created_by,v_request.partner_id,v_request.lead_id,
      v_request.technical_intake_id,v_request.id,v_response.id,v_price,v_currency,
      nullif(p_payload->>'estimated_lead_time_days','')::integer,v_valid_until,'received',
      nullif(p_payload->>'partner_notes',''),nullif(p_payload->>'commercial_assumptions',''),
      nullif(p_payload->>'commercial_exclusions',''),nullif(p_payload->>'payment_terms',''),
      nullif(p_payload->>'delivery_commitment',''),nullif(p_payload->>'quote_reference',''),now()
    )
    on conflict (partner_review_request_id) where partner_review_request_id is not null
    do update set
      partner_review_response_id=excluded.partner_review_response_id,
      price=excluded.price,currency=excluded.currency,lead_time_days=excluded.lead_time_days,
      valid_until=excluded.valid_until,status='received',notes=excluded.notes,
      commercial_assumptions=excluded.commercial_assumptions,exclusions=excluded.exclusions,
      payment_terms=excluded.payment_terms,delivery_commitment=excluded.delivery_commitment,
      quote_reference=excluded.quote_reference,submitted_at=now(),updated_at=now()
    returning * into v_quote;
  end if;

  update public.partner_review_requests
  set status='submitted',submitted_at=now(),updated_at=now()
  where id=v_request.id;

  insert into public.activity_events(organisation_id,user_id,entity_type,entity_id,event_type,event_data)
  values(
    v_request.organisation_id,v_request.created_by,'lead',v_request.lead_id,
    'partner_review_response_submitted',
    jsonb_build_object(
      'partnerReviewRequestId',v_request.id,'responseId',v_response.id,
      'partnerQuoteId',v_quote.id,'revision',v_revision,'feasibility',v_response.feasibility,
      'pricingReadiness',v_response.pricing_readiness,'commercialPrice',v_quote.price,
      'commercialCurrency',v_quote.currency
    )
  );

  update public.leads set next_action='Review partner technical response and submitted commercial price',updated_at=now()
  where id=v_request.lead_id;

  return jsonb_build_object('technical_response',to_jsonb(v_response),'commercial_response',to_jsonb(v_quote));
end $$;

commit;
