begin;

-- A governed partner review may belong either to a pre-Case Prospect or to an existing Case.
alter table public.partner_review_requests alter column lead_id drop not null;
alter table public.partner_review_requests alter column technical_intake_id drop not null;
alter table public.partner_review_requests add column if not exists prospect_id uuid references public.prospects(id) on delete cascade;
alter table public.partner_review_requests add column if not exists intake_session_id uuid references public.intake_sessions(id) on delete restrict;
create index if not exists partner_review_requests_prospect_idx on public.partner_review_requests(organisation_id, prospect_id, created_at desc);

alter table public.partner_quotes alter column lead_id drop not null;
alter table public.partner_quotes add column if not exists prospect_id uuid references public.prospects(id) on delete cascade;
create index if not exists partner_quotes_prospect_idx on public.partner_quotes(organisation_id, prospect_id, created_at desc);

-- Prevent ambiguous ownership. Existing Case-owned rows continue to satisfy the first branch.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='partner_review_request_single_owner') then
    alter table public.partner_review_requests add constraint partner_review_request_single_owner check (
      (lead_id is not null and technical_intake_id is not null and prospect_id is null and intake_session_id is null)
      or
      (lead_id is null and technical_intake_id is null and prospect_id is not null and intake_session_id is not null)
    ) not valid;
    alter table public.partner_review_requests validate constraint partner_review_request_single_owner;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='partner_quote_single_owner') then
    alter table public.partner_quotes add constraint partner_quote_single_owner check (
      (lead_id is not null and prospect_id is null)
      or
      (lead_id is null and prospect_id is not null)
    ) not valid;
    alter table public.partner_quotes validate constraint partner_quote_single_owner;
  end if;
end $$;

create or replace function public.op_create_prospect_partner_review_request(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid,
  p_intake_session_id uuid,
  p_partner_id uuid,
  p_token_hash text,
  p_response_due_at timestamptz,
  p_expires_at timestamptz,
  p_review_instructions text,
  p_scope_summary text,
  p_show_client_identity boolean default false
) returns public.partner_review_requests
language plpgsql security definer set search_path=public
as $$
declare
  v_prospect public.prospects;
  v_session public.intake_sessions;
  v_partner public.partners;
  v_request public.partner_review_requests;
  v_ref text;
begin
  if p_user_id is distinct from auth.uid() then raise exception 'Unauthorised actor'; end if;

  select * into v_prospect from public.prospects
  where id=p_prospect_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Prospect not found'; end if;
  if v_prospect.status in ('converted','not_a_fit','archived') then raise exception 'Prospect is no longer active'; end if;

  select * into v_session from public.intake_sessions
  where id=p_intake_session_id and organisation_id=p_organisation_id and prospect_id=p_prospect_id;
  if not found or v_session.status <> 'submitted' then raise exception 'A submitted Step 2 technical intake is required'; end if;

  select * into v_partner from public.partners where id=p_partner_id and organisation_id=p_organisation_id;
  if not found or v_partner.status <> 'approved' or not coalesce(v_partner.nda_signed,false) then
    raise exception 'An approved NDA-compliant partner is required';
  end if;

  if exists (
    select 1 from public.partner_review_requests
    where organisation_id=p_organisation_id and prospect_id=p_prospect_id
      and status in ('draft','invited','opened','in_progress','submitted','clarification_required','approved','approved_with_conditions')
  ) then raise exception 'An active partner review already exists for this Prospect'; end if;

  v_ref := 'OP-PR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.partner_review_requests(
    organisation_id,prospect_id,intake_session_id,partner_id,token_hash,case_reference,status,
    response_due_at,expires_at,review_instructions,scope_summary,show_client_identity,
    show_commercial_identity,sent_at,created_by
  ) values (
    p_organisation_id,p_prospect_id,p_intake_session_id,p_partner_id,p_token_hash,v_ref,'invited',
    p_response_due_at,p_expires_at,p_review_instructions,p_scope_summary,p_show_client_identity,
    false,now(),p_user_id
  ) returning * into v_request;

  insert into public.partner_review_files(
    organisation_id,partner_review_request_id,intake_file_id,display_name,created_by
  )
  select p_organisation_id,v_request.id,f.id,f.original_filename,p_user_id
  from public.intake_files f
  where f.organisation_id=p_organisation_id and f.intake_session_id=p_intake_session_id;

  update public.prospects set next_action='Await partner technical and pricing response',updated_at=now()
  where id=p_prospect_id and organisation_id=p_organisation_id;

  insert into public.activity_events(organisation_id,user_id,entity_type,entity_id,event_type,event_data)
  values(p_organisation_id,p_user_id,'prospect',p_prospect_id,'partner_review_request_created',
    jsonb_build_object('partnerReviewRequestId',v_request.id,'partnerId',p_partner_id,'reference',v_ref,'responseDueAt',p_response_due_at));

  return v_request;
end $$;

create or replace function public.op_submit_prospect_partner_review_response(
  p_token_hash text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_request public.partner_review_requests;
  v_response public.partner_review_responses;
  v_quote public.partner_quotes;
  v_revision integer;
  v_price numeric;
  v_currency text;
begin
  select * into v_request from public.partner_review_requests
  where token_hash=p_token_hash and prospect_id is not null for update;
  if not found then raise exception 'Invalid Prospect partner-review token'; end if;
  if v_request.status in ('approved','approved_with_conditions','rejected','revoked','expired') then raise exception 'Review is closed'; end if;
  if v_request.expires_at < now() then
    update public.partner_review_requests set status='expired',updated_at=now() where id=v_request.id;
    raise exception 'Review link has expired';
  end if;

  select coalesce(max(revision),0)+1 into v_revision from public.partner_review_responses
  where partner_review_request_id=v_request.id;

  insert into public.partner_review_responses(
    organisation_id,partner_review_request_id,revision,feasibility,confidence_percent,capability_confirmed,
    software_capability,capacity_status,earliest_start_date,estimated_engineering_hours,estimated_lead_time_days,
    pricing_readiness,missing_information,assumptions,technical_risks,proposed_delivery_approach,exclusions,
    partner_notes,not_feasible_reason,declaration_checked,reviewer_name,reviewer_role
  ) values (
    v_request.organisation_id,v_request.id,v_revision,p_payload->>'feasibility',(p_payload->>'confidence_percent')::integer,
    (p_payload->>'capability_confirmed')::boolean,nullif(p_payload->>'software_capability',''),p_payload->>'capacity_status',
    nullif(p_payload->>'earliest_start_date','')::date,nullif(p_payload->>'estimated_engineering_hours','')::numeric,
    nullif(p_payload->>'estimated_lead_time_days','')::integer,p_payload->>'pricing_readiness',
    nullif(p_payload->>'missing_information',''),nullif(p_payload->>'assumptions',''),nullif(p_payload->>'technical_risks',''),
    nullif(p_payload->>'proposed_delivery_approach',''),nullif(p_payload->>'exclusions',''),nullif(p_payload->>'partner_notes',''),
    nullif(p_payload->>'not_feasible_reason',''),(p_payload->>'declaration_checked')::boolean,p_payload->>'reviewer_name',
    nullif(p_payload->>'reviewer_role','')
  ) returning * into v_response;

  if v_response.feasibility in ('feasible','feasible_with_conditions') then
    v_price := nullif(p_payload->>'commercial_price','')::numeric;
    v_currency := upper(nullif(p_payload->>'commercial_currency',''));
    if v_price is null or v_price <= 0 then raise exception 'Feasible responses require a positive partner price'; end if;
    if v_currency is null or length(v_currency) <> 3 then raise exception 'Feasible responses require a three-letter currency'; end if;

    insert into public.partner_quotes(
      organisation_id,created_by,partner_review_request_id,partner_review_response_id,partner_id,
      prospect_id,lead_id,technical_intake_id,price,currency,lead_time_days,valid_until,
      commercial_assumptions,exclusions,payment_terms,delivery_commitment,quote_reference,status,submitted_at
    ) values (
      v_request.organisation_id,v_request.created_by,v_request.id,v_response.id,v_request.partner_id,
      v_request.prospect_id,null,null,v_price,v_currency,v_response.estimated_lead_time_days,
      nullif(p_payload->>'commercial_valid_until','')::date,nullif(p_payload->>'commercial_assumptions',''),
      nullif(p_payload->>'commercial_exclusions',''),nullif(p_payload->>'payment_terms',''),
      nullif(p_payload->>'delivery_commitment',''),nullif(p_payload->>'quote_reference',''),'received',now()
    ) returning * into v_quote;
  end if;

  update public.partner_review_requests set status='submitted',submitted_at=now(),updated_at=now() where id=v_request.id;
  update public.prospects set next_action='Review partner response and record Go / No-Go decision',updated_at=now()
  where id=v_request.prospect_id;

  insert into public.activity_events(organisation_id,user_id,entity_type,entity_id,event_type,event_data)
  values(v_request.organisation_id,v_request.created_by,'prospect',v_request.prospect_id,'partner_review_response_submitted',
    jsonb_build_object('partnerReviewRequestId',v_request.id,'responseId',v_response.id,'partnerQuoteId',v_quote.id,
      'feasibility',v_response.feasibility,'pricingReadiness',v_response.pricing_readiness));

  return jsonb_build_object('technical_response',to_jsonb(v_response),'commercial_response',case when v_quote.id is null then null else to_jsonb(v_quote) end);
end $$;

create or replace function public.op_decide_prospect_partner_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid,
  p_request_id uuid,
  p_response_id uuid,
  p_decision text,
  p_review_notes text default null,
  p_accepted_assumptions text default null,
  p_accepted_risks text default null,
  p_clarification_request text default null
) returns public.partner_review_internal_decisions
language plpgsql security definer set search_path=public
as $$
declare
  v_request public.partner_review_requests;
  v_response public.partner_review_responses;
  v_quote public.partner_quotes;
  v_decision public.partner_review_internal_decisions;
  v_status text;
begin
  if p_user_id is distinct from auth.uid() then raise exception 'Unauthorised actor'; end if;
  if p_decision not in ('approved','approved_with_conditions','clarification_required','rejected') then raise exception 'Invalid decision'; end if;

  select * into v_request from public.partner_review_requests
  where id=p_request_id and organisation_id=p_organisation_id and prospect_id=p_prospect_id for update;
  if not found or v_request.status <> 'submitted' then raise exception 'A submitted partner response is required'; end if;

  select * into v_response from public.partner_review_responses
  where id=p_response_id and partner_review_request_id=v_request.id;
  if not found then raise exception 'Partner response not found'; end if;

  if p_decision in ('approved','approved_with_conditions') then
    if v_response.feasibility not in ('feasible','feasible_with_conditions') then raise exception 'Only a feasible partner response can be approved'; end if;
    select * into v_quote from public.partner_quotes
    where partner_review_request_id=v_request.id and partner_review_response_id=v_response.id and status='received'
    order by created_at desc limit 1;
    if not found or coalesce(v_quote.price,0) <= 0 then raise exception 'Received partner pricing is required before approval'; end if;
  end if;

  if p_decision='clarification_required' and nullif(trim(coalesce(p_clarification_request,'')),'') is null then
    raise exception 'Clarification details are required';
  end if;

  insert into public.partner_review_internal_decisions(
    organisation_id,partner_review_request_id,partner_review_response_id,decision,review_notes,
    accepted_assumptions,accepted_risks,clarification_request,reviewed_by,approved_at
  ) values (
    p_organisation_id,p_request_id,p_response_id,p_decision,p_review_notes,p_accepted_assumptions,
    p_accepted_risks,p_clarification_request,p_user_id,
    case when p_decision in ('approved','approved_with_conditions') then now() else null end
  ) returning * into v_decision;

  v_status := case p_decision
    when 'approved' then 'approved'
    when 'approved_with_conditions' then 'approved_with_conditions'
    when 'clarification_required' then 'clarification_required'
    else 'rejected' end;
  update public.partner_review_requests set status=v_status,updated_at=now() where id=v_request.id;

  if p_decision in ('approved','approved_with_conditions') then
    update public.prospects set status='qualified',assigned_to=p_user_id,next_action='Create governed Case 360',updated_at=now()
    where id=p_prospect_id and organisation_id=p_organisation_id;
  elsif p_decision='rejected' then
    update public.prospects set status='not_a_fit',next_action='Closed after partner feasibility review',updated_at=now()
    where id=p_prospect_id and organisation_id=p_organisation_id;
  else
    update public.prospects set next_action='Resolve partner clarification before Go / No-Go',updated_at=now()
    where id=p_prospect_id and organisation_id=p_organisation_id;
  end if;

  insert into public.activity_events(organisation_id,user_id,entity_type,entity_id,event_type,event_data)
  values(p_organisation_id,p_user_id,'prospect',p_prospect_id,'partner_review_internal_decision',
    jsonb_build_object('partnerReviewRequestId',p_request_id,'responseId',p_response_id,'decision',p_decision));
  return v_decision;
end $$;

-- Database guard: qualification is a governed result of a real partner response and accepted partner pricing.
create or replace function public.op_guard_prospect_qualification()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='qualified' and coalesce(old.status,'') <> 'qualified' then
    if not exists (
      select 1
      from public.partner_review_requests r
      join public.partner_review_responses s on s.partner_review_request_id=r.id
      join public.partner_review_internal_decisions d on d.partner_review_request_id=r.id and d.partner_review_response_id=s.id
      join public.partner_quotes q on q.partner_review_request_id=r.id and q.partner_review_response_id=s.id
      where r.organisation_id=new.organisation_id and r.prospect_id=new.id
        and r.status in ('approved','approved_with_conditions')
        and s.feasibility in ('feasible','feasible_with_conditions')
        and d.decision in ('approved','approved_with_conditions')
        and q.status in ('received','selected','approved') and q.price > 0
    ) then raise exception 'OS_INTEGRITY: Prospect cannot be qualified before governed partner response, pricing and Go / No-Go approval.'; end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_op_guard_prospect_qualification on public.prospects;
create trigger trg_op_guard_prospect_qualification before update of status on public.prospects
for each row execute function public.op_guard_prospect_qualification();

-- When Acquisition converts, move the already-approved partner evidence into Case ownership atomically.
create or replace function public.op_inherit_prospect_partner_review_to_case()
returns trigger language plpgsql set search_path=public as $$
declare v_intake_id uuid;
begin
  if new.converted_lead_id is not null and old.converted_lead_id is distinct from new.converted_lead_id then
    select id into v_intake_id from public.technical_intakes
    where organisation_id=new.organisation_id and lead_id=new.converted_lead_id
    order by created_at desc limit 1;

    update public.partner_review_requests
      set lead_id=new.converted_lead_id, technical_intake_id=v_intake_id, prospect_id=null, intake_session_id=null, updated_at=now()
      where organisation_id=new.organisation_id and prospect_id=new.id;

    update public.partner_quotes
      set lead_id=new.converted_lead_id, technical_intake_id=v_intake_id, prospect_id=null, updated_at=now()
      where organisation_id=new.organisation_id and prospect_id=new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_op_inherit_prospect_partner_review_to_case on public.prospects;
create trigger trg_op_inherit_prospect_partner_review_to_case after update of converted_lead_id on public.prospects
for each row execute function public.op_inherit_prospect_partner_review_to_case();

commit;
