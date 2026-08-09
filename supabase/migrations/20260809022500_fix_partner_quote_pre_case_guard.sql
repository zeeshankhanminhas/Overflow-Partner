begin;

-- Allow governed commercial responses to belong to either the pre-Case Prospect
-- or the post-conversion Case, while preserving single-owner integrity.
create or replace function public.op_enforce_partner_quote_review()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_request public.partner_review_requests;
begin
  if new.partner_review_request_id is null then
    raise exception 'Partner review linkage is required for a commercial response';
  end if;

  select * into v_request
  from public.partner_review_requests
  where id = new.partner_review_request_id
    and organisation_id = new.organisation_id
    and partner_id = new.partner_id;

  if not found then
    raise exception 'Commercial response does not match the governed partner review';
  end if;

  -- Exactly one lifecycle owner must match the governed partner review.
  if v_request.prospect_id is not null then
    if new.prospect_id is distinct from v_request.prospect_id
       or new.lead_id is not null then
      raise exception 'Commercial response does not match the governed Prospect partner review';
    end if;
  elsif v_request.lead_id is not null then
    if new.lead_id is distinct from v_request.lead_id
       or new.prospect_id is not null then
      raise exception 'Commercial response does not match the governed Case partner review';
    end if;
  else
    raise exception 'Partner review has no active lifecycle owner';
  end if;

  if new.partner_review_response_id is null then
    select id into new.partner_review_response_id
    from public.partner_review_responses
    where partner_review_request_id = v_request.id
    order by revision desc
    limit 1;
  elsif not exists (
    select 1
    from public.partner_review_responses r
    where r.id = new.partner_review_response_id
      and r.partner_review_request_id = v_request.id
  ) then
    raise exception 'Commercial response does not match the governed partner response';
  end if;

  -- Selection remains an internal post-response decision.
  if new.status = 'selected'
     and v_request.status not in ('approved','approved_with_conditions') then
    raise exception 'Commercial response cannot be selected until the partner review is internally approved';
  end if;

  return new;
end $$;

commit;
