begin;

-- Case 360 inherits an already-governed partner response from Acquisition.
-- Creating the internal selling-price decision must not attempt to select the
-- partner again or re-run the legacy technical-intake partner-selection gate.
create or replace function public.op_create_commercial_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_partner_quote_id uuid,
  p_markup_percent numeric
) returns public.commercial_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.partner_quotes;
  v_request public.partner_review_requests;
  v_response public.partner_review_responses;
  v_decision public.partner_review_internal_decisions;
  v_review public.commercial_reviews;
  v_cost numeric;
  v_client_price numeric;
  v_margin numeric;
  v_margin_percent numeric;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);

  if p_markup_percent is null or p_markup_percent < 0 or p_markup_percent > 500 then
    raise exception 'Markup must be between 0 and 500.';
  end if;

  select * into v_quote
  from public.partner_quotes
  where id = p_partner_quote_id
    and organisation_id = p_organisation_id
  for update;

  if not found then
    raise exception 'Partner pricing not found.';
  end if;

  if v_quote.lead_id is null or v_quote.prospect_id is not null then
    raise exception 'Commercial margin can only be created after the opportunity is owned by Case 360.';
  end if;

  if v_quote.status::text not in ('received', 'selected') then
    raise exception 'Commercial review requires received governed partner pricing.';
  end if;

  if coalesce(v_quote.price, 0) <= 0 then
    raise exception 'A positive governed partner cost is required before margin can be set.';
  end if;

  if v_quote.partner_review_request_id is null or v_quote.partner_review_response_id is null then
    raise exception 'Commercial review requires the inherited governed partner response.';
  end if;

  select * into v_request
  from public.partner_review_requests
  where id = v_quote.partner_review_request_id
    and organisation_id = p_organisation_id
    and lead_id = v_quote.lead_id
    and partner_id = v_quote.partner_id;

  if not found or v_request.status::text not in ('approved', 'approved_with_conditions') then
    raise exception 'The inherited partner review must have an approved Go / No-Go decision before margin can be set.';
  end if;

  select * into v_response
  from public.partner_review_responses
  where id = v_quote.partner_review_response_id
    and partner_review_request_id = v_request.id;

  if not found or v_response.feasibility::text not in ('feasible', 'feasible_with_conditions') then
    raise exception 'A feasible governed partner response is required before margin can be set.';
  end if;

  select * into v_decision
  from public.partner_review_internal_decisions
  where partner_review_request_id = v_request.id
    and partner_review_response_id = v_response.id
    and decision::text in ('approved', 'approved_with_conditions')
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Internal Go / No-Go approval is required before margin can be set.';
  end if;

  if exists (
    select 1
    from public.commercial_reviews cr
    where cr.organisation_id = p_organisation_id
      and cr.lead_id = v_quote.lead_id
      and cr.status::text in ('draft', 'pending_approval', 'approved')
  ) then
    raise exception 'An active Commercial Review already exists for this Case.';
  end if;

  v_cost := v_quote.price;
  v_client_price := round(v_cost * (1 + p_markup_percent / 100.0), 2);
  v_margin := round(v_client_price - v_cost, 2);
  v_margin_percent := case
    when v_client_price > 0 then round((v_margin / v_client_price) * 100.0, 4)
    else 0
  end;

  insert into public.commercial_reviews(
    organisation_id,
    lead_id,
    partner_quote_id,
    cost_price,
    client_price,
    margin_amount,
    margin_percent,
    status,
    created_by
  ) values (
    p_organisation_id,
    v_quote.lead_id,
    v_quote.id,
    v_cost,
    v_client_price,
    v_margin,
    v_margin_percent,
    'pending_approval',
    p_user_id
  )
  returning * into v_review;

  -- Deliberately DO NOT update partner_quotes.status here.
  -- Partner selection already occurred upstream through the governed Acquisition
  -- partner review and Go / No-Go decision. Case 360 only structures client economics.

  perform public.op_record_activity(
    p_organisation_id,
    p_user_id,
    'lead',
    v_quote.lead_id,
    'commercial_margin_created',
    jsonb_build_object(
      'commercialReviewId', v_review.id,
      'partnerQuoteId', v_quote.id,
      'partnerReviewRequestId', v_request.id,
      'partnerReviewResponseId', v_response.id,
      'costPrice', v_cost,
      'markupPercent', p_markup_percent,
      'clientPrice', v_client_price,
      'marginAmount', v_margin,
      'marginPercent', v_margin_percent,
      'source', 'inherited_governed_partner_response'
    )
  );

  return v_review;
end;
$$;

commit;
