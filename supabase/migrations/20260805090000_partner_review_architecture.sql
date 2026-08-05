begin;

create extension if not exists pgcrypto;

create table if not exists public.partner_review_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  technical_intake_id uuid not null references public.technical_intakes(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  token_hash text not null unique,
  case_reference text not null,
  status text not null default 'invited' check (status in ('draft','invited','opened','in_progress','submitted','clarification_required','approved','approved_with_conditions','rejected','revoked','expired')),
  response_due_at timestamptz not null,
  expires_at timestamptz not null,
  review_instructions text,
  scope_summary text not null,
  show_client_identity boolean not null default false,
  show_commercial_identity boolean not null default false,
  sent_at timestamptz,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_review_one_active_per_partner_lead
  on public.partner_review_requests(organisation_id, lead_id, partner_id)
  where status in ('draft','invited','opened','in_progress','submitted','clarification_required','approved','approved_with_conditions');
create index if not exists partner_review_requests_org_lead_idx on public.partner_review_requests(organisation_id, lead_id, created_at desc);
create index if not exists partner_review_requests_partner_idx on public.partner_review_requests(organisation_id, partner_id, status);
create index if not exists partner_review_requests_token_idx on public.partner_review_requests(token_hash);

create table if not exists public.partner_review_files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  partner_review_request_id uuid not null references public.partner_review_requests(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  intake_file_id uuid references public.intake_files(id) on delete set null,
  display_name text not null,
  storage_path text,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (document_id is not null or intake_file_id is not null or storage_path is not null)
);
create index if not exists partner_review_files_request_idx on public.partner_review_files(partner_review_request_id);

create table if not exists public.partner_review_responses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  partner_review_request_id uuid not null references public.partner_review_requests(id) on delete cascade,
  revision integer not null default 1,
  feasibility text not null check (feasibility in ('feasible','feasible_with_conditions','more_information_required','not_feasible')),
  confidence_percent integer not null check (confidence_percent between 0 and 100),
  capability_confirmed boolean not null,
  software_capability text,
  capacity_status text not null check (capacity_status in ('available','limited','unavailable')),
  earliest_start_date date,
  estimated_engineering_hours numeric(12,2),
  estimated_lead_time_days integer,
  pricing_readiness text not null check (pricing_readiness in ('ready','pending_information','technical_review_only')),
  missing_information text,
  assumptions text,
  technical_risks text,
  proposed_delivery_approach text,
  exclusions text,
  partner_notes text,
  not_feasible_reason text,
  declaration_checked boolean not null,
  reviewer_name text not null,
  reviewer_role text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(partner_review_request_id, revision),
  check (declaration_checked),
  check (feasibility not in ('feasible','feasible_with_conditions') or (estimated_engineering_hours is not null and estimated_lead_time_days is not null)),
  check (feasibility <> 'feasible_with_conditions' or nullif(trim(coalesce(assumptions,'')), '') is not null),
  check (feasibility <> 'more_information_required' or nullif(trim(coalesce(missing_information,'')), '') is not null),
  check (feasibility <> 'not_feasible' or nullif(trim(coalesce(not_feasible_reason,'')), '') is not null)
);
create index if not exists partner_review_responses_request_idx on public.partner_review_responses(partner_review_request_id, revision desc);

create table if not exists public.partner_review_revisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  partner_review_request_id uuid not null references public.partner_review_requests(id) on delete cascade,
  previous_response_id uuid references public.partner_review_responses(id) on delete restrict,
  revision_number integer not null,
  clarification_request text not null,
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(partner_review_request_id, revision_number)
);

create table if not exists public.partner_review_internal_decisions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  partner_review_request_id uuid not null references public.partner_review_requests(id) on delete cascade,
  partner_review_response_id uuid not null references public.partner_review_responses(id) on delete restrict,
  decision text not null check (decision in ('approved','approved_with_conditions','clarification_required','rejected')),
  review_notes text,
  accepted_assumptions text,
  accepted_risks text,
  clarification_request text,
  reviewed_by uuid not null references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(partner_review_response_id),
  check (decision <> 'clarification_required' or nullif(trim(coalesce(clarification_request,'')), '') is not null)
);
create index if not exists partner_review_decisions_request_idx on public.partner_review_internal_decisions(partner_review_request_id, created_at desc);

alter table public.partner_quotes add column if not exists partner_review_request_id uuid references public.partner_review_requests(id) on delete restrict;
alter table public.partner_quotes add column if not exists partner_review_response_id uuid references public.partner_review_responses(id) on delete restrict;
alter table public.partner_quotes add column if not exists commercial_assumptions text;
alter table public.partner_quotes add column if not exists exclusions text;
alter table public.partner_quotes add column if not exists payment_terms text;
alter table public.partner_quotes add column if not exists delivery_commitment text;
alter table public.partner_quotes add column if not exists quote_reference text;
create index if not exists partner_quotes_review_idx on public.partner_quotes(partner_review_request_id, status);

alter table public.partner_review_requests enable row level security;
alter table public.partner_review_files enable row level security;
alter table public.partner_review_responses enable row level security;
alter table public.partner_review_revisions enable row level security;
alter table public.partner_review_internal_decisions enable row level security;

create policy partner_review_requests_org_access on public.partner_review_requests
  for all using (organisation_id = (select organisation_id from public.profiles where id = auth.uid()))
  with check (organisation_id = (select organisation_id from public.profiles where id = auth.uid()));
create policy partner_review_files_org_access on public.partner_review_files
  for all using (organisation_id = (select organisation_id from public.profiles where id = auth.uid()))
  with check (organisation_id = (select organisation_id from public.profiles where id = auth.uid()));
create policy partner_review_responses_org_access on public.partner_review_responses
  for all using (organisation_id = (select organisation_id from public.profiles where id = auth.uid()))
  with check (organisation_id = (select organisation_id from public.profiles where id = auth.uid()));
create policy partner_review_revisions_org_access on public.partner_review_revisions
  for all using (organisation_id = (select organisation_id from public.profiles where id = auth.uid()))
  with check (organisation_id = (select organisation_id from public.profiles where id = auth.uid()));
create policy partner_review_decisions_org_access on public.partner_review_internal_decisions
  for all using (organisation_id = (select organisation_id from public.profiles where id = auth.uid()))
  with check (organisation_id = (select organisation_id from public.profiles where id = auth.uid()));

create or replace function public.op_create_partner_review_request(
  p_organisation_id uuid,
  p_user_id uuid,
  p_lead_id uuid,
  p_technical_intake_id uuid,
  p_partner_id uuid,
  p_token_hash text,
  p_response_due_at timestamptz,
  p_expires_at timestamptz,
  p_review_instructions text,
  p_scope_summary text,
  p_show_client_identity boolean default false,
  p_show_commercial_identity boolean default false
) returns public.partner_review_requests
language plpgsql security definer set search_path = public as $$
declare v_partner public.partners; v_intake public.technical_intakes; v_request public.partner_review_requests; v_ref text;
begin
  if p_user_id is distinct from auth.uid() then raise exception 'Unauthorised actor'; end if;
  select * into v_intake from public.technical_intakes where id=p_technical_intake_id and organisation_id=p_organisation_id and lead_id=p_lead_id;
  if not found or v_intake.status <> 'approved' then raise exception 'Approved technical scope is required'; end if;
  select * into v_partner from public.partners where id=p_partner_id and organisation_id=p_organisation_id;
  if not found or v_partner.status <> 'approved' or not coalesce(v_partner.nda_signed,false) then raise exception 'An approved NDA-compliant partner is required'; end if;
  if exists(select 1 from public.partner_review_requests where organisation_id=p_organisation_id and lead_id=p_lead_id and partner_id=p_partner_id and status in ('draft','invited','opened','in_progress','submitted','clarification_required','approved','approved_with_conditions')) then raise exception 'An active review already exists for this lead and partner'; end if;
  v_ref := 'OP-PR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.partner_review_requests(organisation_id,lead_id,technical_intake_id,partner_id,token_hash,case_reference,status,response_due_at,expires_at,review_instructions,scope_summary,show_client_identity,show_commercial_identity,sent_at,created_by)
  values(p_organisation_id,p_lead_id,p_technical_intake_id,p_partner_id,p_token_hash,v_ref,'invited',p_response_due_at,p_expires_at,p_review_instructions,p_scope_summary,p_show_client_identity,p_show_commercial_identity,now(),p_user_id)
  returning * into v_request;
  insert into public.activity_events(organisation_id,user_id,entity_type,entity_id,event_type,event_data)
  values(p_organisation_id,p_user_id,'lead',p_lead_id,'partner_review_request_created',jsonb_build_object('partnerReviewRequestId',v_request.id,'partnerId',p_partner_id,'caseReference',v_ref,'responseDueAt',p_response_due_at));
  update public.leads set next_action='Await partner technical review', updated_at=now() where id=p_lead_id and organisation_id=p_organisation_id;
  return v_request;
end $$;

create or replace function public.op_submit_partner_review_response(
  p_token_hash text,
  p_payload jsonb
) returns public.partner_review_responses
language plpgsql security definer set search_path = public as $$
declare v_request public.partner_review_requests; v_response public.partner_review_responses; v_revision integer;
begin
  select * into v_request from public.partner_review_requests where token_hash=p_token_hash for update;
  if not found then raise exception 'Invalid review token'; end if;
  if v_request.status in ('approved','approved_with_conditions','rejected','revoked','expired') then raise exception 'Review is closed'; end if;
  if v_request.expires_at < now() then update public.partner_review_requests set status='expired',updated_at=now() where id=v_request.id; raise exception 'Review link has expired'; end if;
  select coalesce(max(revision),0)+1 into v_revision from public.partner_review_responses where partner_review_request_id=v_request.id;
  insert into public.partner_review_responses(organisation_id,partner_review_request_id,revision,feasibility,confidence_percent,capability_confirmed,software_capability,capacity_status,earliest_start_date,estimated_engineering_hours,estimated_lead_time_days,pricing_readiness,missing_information,assumptions,technical_risks,proposed_delivery_approach,exclusions,partner_notes,not_feasible_reason,declaration_checked,reviewer_name,reviewer_role)
  values(v_request.organisation_id,v_request.id,v_revision,p_payload->>'feasibility',(p_payload->>'confidence_percent')::integer,(p_payload->>'capability_confirmed')::boolean,nullif(p_payload->>'software_capability',''),p_payload->>'capacity_status',nullif(p_payload->>'earliest_start_date','')::date,nullif(p_payload->>'estimated_engineering_hours','')::numeric,nullif(p_payload->>'estimated_lead_time_days','')::integer,p_payload->>'pricing_readiness',nullif(p_payload->>'missing_information',''),nullif(p_payload->>'assumptions',''),nullif(p_payload->>'technical_risks',''),nullif(p_payload->>'proposed_delivery_approach',''),nullif(p_payload->>'exclusions',''),nullif(p_payload->>'partner_notes',''),nullif(p_payload->>'not_feasible_reason',''),(p_payload->>'declaration_checked')::boolean,p_payload->>'reviewer_name',nullif(p_payload->>'reviewer_role',''))
  returning * into v_response;
  update public.partner_review_requests set status='submitted',submitted_at=now(),updated_at=now() where id=v_request.id;
  insert into public.activity_events(organisation_id,user_id,entity_type,entity_id,event_type,event_data)
  values(v_request.organisation_id,v_request.created_by,'lead',v_request.lead_id,'partner_review_response_submitted',jsonb_build_object('partnerReviewRequestId',v_request.id,'responseId',v_response.id,'revision',v_revision,'feasibility',v_response.feasibility,'pricingReadiness',v_response.pricing_readiness));
  update public.leads set next_action='Review partner technical response',updated_at=now() where id=v_request.lead_id;
  return v_response;
end $$;

create or replace function public.op_decide_partner_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_request_id uuid,
  p_response_id uuid,
  p_decision text,
  p_review_notes text default null,
  p_accepted_assumptions text default null,
  p_accepted_risks text default null,
  p_clarification_request text default null
) returns public.partner_review_internal_decisions
language plpgsql security definer set search_path = public as $$
declare v_request public.partner_review_requests; v_response public.partner_review_responses; v_decision public.partner_review_internal_decisions; v_status text;
begin
  if p_user_id is distinct from auth.uid() then raise exception 'Unauthorised actor'; end if;
  select * into v_request from public.partner_review_requests where id=p_request_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Partner review not found'; end if;
  select * into v_response from public.partner_review_responses where id=p_response_id and partner_review_request_id=p_request_id;
  if not found then raise exception 'Partner response not found'; end if;
  if p_decision in ('approved','approved_with_conditions') and v_response.feasibility in ('not_feasible','more_information_required') then raise exception 'This feasibility outcome cannot be approved for commercial progression'; end if;
  v_status := case p_decision when 'approved' then 'approved' when 'approved_with_conditions' then 'approved_with_conditions' when 'clarification_required' then 'clarification_required' else 'rejected' end;
  insert into public.partner_review_internal_decisions(organisation_id,partner_review_request_id,partner_review_response_id,decision,review_notes,accepted_assumptions,accepted_risks,clarification_request,reviewed_by,approved_at)
  values(p_organisation_id,p_request_id,p_response_id,p_decision,p_review_notes,p_accepted_assumptions,p_accepted_risks,p_clarification_request,p_user_id,case when p_decision in ('approved','approved_with_conditions') then now() else null end)
  returning * into v_decision;
  update public.partner_review_requests set status=v_status,updated_at=now() where id=p_request_id;
  if p_decision='clarification_required' then
    insert into public.partner_review_revisions(organisation_id,partner_review_request_id,previous_response_id,revision_number,clarification_request,requested_by)
    values(p_organisation_id,p_request_id,p_response_id,v_response.revision+1,p_clarification_request,p_user_id);
  end if;
  insert into public.activity_events(organisation_id,user_id,entity_type,entity_id,event_type,event_data)
  values(p_organisation_id,p_user_id,'lead',v_request.lead_id,case when p_decision='clarification_required' then 'partner_review_clarification_requested' when p_decision='rejected' then 'partner_review_rejected' else 'partner_review_approved' end,jsonb_build_object('partnerReviewRequestId',p_request_id,'responseId',p_response_id,'decision',p_decision));
  update public.leads set next_action=case when p_decision in ('approved','approved_with_conditions') then 'Request partner commercial response' when p_decision='clarification_required' then 'Await revised partner response' else 'Select another technical partner' end,updated_at=now() where id=v_request.lead_id;
  return v_decision;
end $$;

create or replace function public.op_enforce_partner_quote_review() returns trigger
language plpgsql set search_path=public as $$
declare v_request public.partner_review_requests;
begin
  if new.partner_review_request_id is null then raise exception 'Approved technical partner review is required before commercial response'; end if;
  select * into v_request from public.partner_review_requests where id=new.partner_review_request_id and organisation_id=new.organisation_id and lead_id=new.lead_id and partner_id=new.partner_id;
  if not found or v_request.status not in ('approved','approved_with_conditions') then raise exception 'Partner technical review is not approved'; end if;
  if new.partner_review_response_id is null then
    select id into new.partner_review_response_id from public.partner_review_responses where partner_review_request_id=v_request.id order by revision desc limit 1;
  end if;
  return new;
end $$;
drop trigger if exists partner_quote_requires_approved_review on public.partner_quotes;
create trigger partner_quote_requires_approved_review before insert or update of partner_review_request_id,partner_id,lead_id on public.partner_quotes for each row execute function public.op_enforce_partner_quote_review();

commit;
