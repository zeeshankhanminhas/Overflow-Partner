begin;

-- ================================================================
-- Overflow Partner canonical lifecycle lock
-- docs/BUSINESS_LIFECYCLE_CONSTITUTION.md is the normative model.
-- ================================================================

-- ---------- Client acceptance / release / review evidence ----------

create table if not exists public.quote_acceptance_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  acceptance_basis text not null check (acceptance_basis in ('signed_quote','purchase_order','email_confirmation','client_portal','other_written')),
  evidence_reference text not null,
  accepted_by_name text not null,
  accepted_by_email text,
  notes text,
  accepted_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organisation_id, quote_id)
);

create table if not exists public.project_client_transmittals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  transmittal_reference text not null,
  recipient_name text not null,
  recipient_email text,
  delivery_method text not null check (delivery_method in ('email','secure_link','client_portal','other')),
  document_manifest jsonb not null default '[]'::jsonb,
  note text,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organisation_id, transmittal_reference)
);

create table if not exists public.project_client_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  transmittal_id uuid references public.project_client_transmittals(id) on delete restrict,
  outcome text not null check (outcome in ('accepted','accepted_with_comments','changes_requested','rejected')),
  evidence_basis text not null check (evidence_basis in ('email_confirmation','signed_acceptance','client_portal','meeting_record','other_written')),
  evidence_reference text not null,
  comments text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists quote_acceptance_records_quote_idx on public.quote_acceptance_records(organisation_id,quote_id);
create index if not exists project_client_transmittals_project_idx on public.project_client_transmittals(organisation_id,project_id,issued_at desc);
create index if not exists project_client_reviews_project_idx on public.project_client_reviews(organisation_id,project_id,recorded_at desc);

alter table public.quote_acceptance_records enable row level security;
alter table public.project_client_transmittals enable row level security;
alter table public.project_client_reviews enable row level security;

do $$
declare t text;
begin
  foreach t in array array['quote_acceptance_records','project_client_transmittals','project_client_reviews'] loop
    execute format('drop policy if exists %I_org_access on public.%I', t, t);
    execute format($policy$
      create policy %I_org_access on public.%I
      for all using (
        exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=%I.organisation_id and p.is_active=true)
      ) with check (
        exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=%I.organisation_id and p.is_active=true)
      )
    $policy$, t, t, t, t);
  end loop;
end $$;

-- ---------- Revision-aware partner execution ----------

alter table public.project_execution_assignments add column if not exists execution_cycle integer not null default 1;
alter table public.partner_delivery_submissions add column if not exists execution_cycle integer not null default 1;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='project_execution_assignments_cycle_positive') then
    alter table public.project_execution_assignments add constraint project_execution_assignments_cycle_positive check (execution_cycle > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='partner_delivery_submissions_cycle_positive') then
    alter table public.partner_delivery_submissions add constraint partner_delivery_submissions_cycle_positive check (execution_cycle > 0);
  end if;
end $$;

create index if not exists partner_delivery_submissions_cycle_idx
  on public.partner_delivery_submissions(assignment_id,execution_cycle,submitted_at desc);

-- ---------- Canonical controlled-document names ----------

-- If a canonical Scope of Work already exists, retire the legacy duplicate.
update public.documents legacy
set status='superseded'::public.document_status,
    is_current_revision=false,
    superseded_at=coalesce(legacy.superseded_at,now()),
    updated_at=now()
where legacy.document_type='scope_of_work'
  and exists (
    select 1 from public.documents canonical
    where canonical.organisation_id=legacy.organisation_id
      and canonical.document_type='scope-of-work'
      and canonical.status::text <> 'superseded'
      and ((legacy.project_id is not null and canonical.project_id=legacy.project_id)
        or (legacy.project_id is null and legacy.lead_id is not null and canonical.lead_id=legacy.lead_id))
  );

update public.documents
set document_type='scope-of-work',updated_at=now()
where document_type='scope_of_work' and status::text <> 'superseded';

update public.documents legacy
set status='superseded'::public.document_status,
    is_current_revision=false,
    superseded_at=coalesce(legacy.superseded_at,now()),
    updated_at=now()
where legacy.document_type='client_quote'
  and exists (
    select 1 from public.documents canonical
    where canonical.organisation_id=legacy.organisation_id
      and canonical.document_type='client-quote'
      and canonical.status::text <> 'superseded'
      and canonical.quote_id=legacy.quote_id
  );

update public.documents
set document_type='client-quote',updated_at=now()
where document_type='client_quote' and status::text <> 'superseded';

-- A closeout publication does not belong at Project creation. Retire legacy draft shells.
update public.documents
set status='superseded'::public.document_status,
    is_current_revision=false,
    superseded_at=coalesce(superseded_at,now()),
    updated_at=now()
where document_type='project_closeout' and status::text='draft';

update public.documents
set document_type='completion-report',updated_at=now()
where document_type='project_closeout' and status::text <> 'superseded';

-- Keep only the strongest current controlled quotation for a Quote.
with ranked as (
  select id,
         row_number() over (
           partition by organisation_id,quote_id
           order by case status::text when 'published' then 6 when 'issued' then 5 when 'approved' then 4 when 'signed' then 3 when 'in_review' then 2 else 1 end desc,
                    created_at desc
         ) as rn
  from public.documents
  where document_type='client-quote' and quote_id is not null and status::text <> 'superseded'
)
update public.documents d
set status='superseded'::public.document_status,
    is_current_revision=false,
    superseded_at=coalesce(d.superseded_at,now()),
    updated_at=now()
from ranked r
where d.id=r.id and r.rn>1;

-- ---------- Acquisition is the only pre-commercial Partner Review owner ----------

create or replace function public.op_guard_case_partner_review_creation()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.lead_id is not null and new.prospect_id is null then
    raise exception 'OS_INTEGRITY: New pre-commercial Partner Reviews must be completed in Acquisition before Case 360 is created.';
  end if;
  return new;
end $$;

drop trigger if exists trg_op_guard_case_partner_review_creation on public.partner_review_requests;
create trigger trg_op_guard_case_partner_review_creation
before insert on public.partner_review_requests
for each row execute function public.op_guard_case_partner_review_creation();

-- ---------- Prospect -> Case conversion uses the governed Acquisition evidence ----------

create or replace function public.op_convert_prospect(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid
) returns public.leads
language plpgsql security definer set search_path=public
as $$
declare
  v_prospect public.prospects;
  v_company public.companies;
  v_contact public.contacts;
  v_lead public.leads;
  v_lead_ref text;
  v_session public.intake_sessions;
  v_submission public.intake_submissions;
  v_intake public.technical_intakes;
  v_review_request_id uuid;
  v_partner_id uuid;
  v_doc_ref text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_prospect from public.prospects where organisation_id=p_organisation_id and id=p_prospect_id for update;
  if not found then raise exception 'Prospect not found.'; end if;
  if v_prospect.converted_lead_id is not null then
    select * into v_lead from public.leads where id=v_prospect.converted_lead_id;
    return v_lead;
  end if;
  if v_prospect.status <> 'qualified' then raise exception 'Only a governed qualified Prospect can become Case 360.'; end if;
  if nullif(trim(v_prospect.company_name),'') is null then raise exception 'Company name is required.'; end if;
  if nullif(trim(coalesce(v_prospect.requirement_summary,'')),'') is null then raise exception 'Structured requirement summary is required.'; end if;
  if nullif(trim(coalesce(v_prospect.project_type,'')),'') is null then raise exception 'Project type is required.'; end if;

  select r.id,r.partner_id into v_review_request_id,v_partner_id
  from public.partner_review_requests r
  join public.partner_review_responses s on s.partner_review_request_id=r.id
  join public.partner_review_internal_decisions d on d.partner_review_request_id=r.id and d.partner_review_response_id=s.id
  join public.partner_quotes q on q.partner_review_request_id=r.id and q.partner_review_response_id=s.id
  where r.organisation_id=p_organisation_id and r.prospect_id=p_prospect_id
    and r.status::text in ('approved','approved_with_conditions')
    and s.feasibility::text in ('feasible','feasible_with_conditions')
    and d.decision::text in ('approved','approved_with_conditions')
    and q.status::text in ('received','selected') and q.price>0
  order by d.created_at desc,q.created_at desc
  limit 1;
  if v_review_request_id is null then
    raise exception 'OS_INTEGRITY: Case 360 requires the approved Acquisition Partner Review, positive partner pricing and Go / No-Go decision.';
  end if;

  select * into v_session from public.intake_sessions
  where organisation_id=p_organisation_id and prospect_id=p_prospect_id and status='submitted'
  order by submitted_at desc limit 1;
  if not found then raise exception 'A submitted Step 2 technical intake is required before Case creation.'; end if;
  select * into v_submission from public.intake_submissions where intake_session_id=v_session.id;
  if not found then raise exception 'The submitted Step 2 technical evidence could not be found.'; end if;

  select * into v_company from public.companies
  where organisation_id=p_organisation_id and lower(name)=lower(v_prospect.company_name) limit 1;
  if not found then
    insert into public.companies(organisation_id,name,industry,created_by)
    values(p_organisation_id,v_prospect.company_name,v_prospect.industry,p_user_id)
    returning * into v_company;
  end if;

  if v_prospect.contact_name is not null then
    select * into v_contact from public.contacts
    where organisation_id=p_organisation_id and company_id=v_company.id
      and ((v_prospect.email is not null and lower(email)=lower(v_prospect.email)) or lower(full_name)=lower(v_prospect.contact_name))
    limit 1;
    if not found then
      insert into public.contacts(organisation_id,company_id,full_name,job_title,email,phone,linkedin_url,created_by)
      values(p_organisation_id,v_company.id,v_prospect.contact_name,v_prospect.job_title,v_prospect.email,v_prospect.phone,v_prospect.linkedin_url,p_user_id)
      returning * into v_contact;
    end if;
  end if;

  v_lead_ref:=public.op_next_reference(p_organisation_id,'lead',null);
  insert into public.leads(
    organisation_id,created_by,owner_id,company_name,contact_name,contact_email,project_type,status,notes,
    company_id,contact_id,prospect_id,source,title,service,priority,reference,next_action
  ) values (
    p_organisation_id,p_user_id,p_user_id,v_prospect.company_name,v_prospect.contact_name,v_prospect.email,v_prospect.project_type,
    'qualified',v_prospect.requirement_summary,v_company.id,case when v_contact.id is null then null else v_contact.id end,
    v_prospect.id,v_prospect.source,v_prospect.company_name||' — '||v_prospect.project_type,'Engineering overflow support','normal',v_lead_ref,
    'Control inherited customer requirements and technical scope'
  ) returning * into v_lead;

  insert into public.technical_intakes(
    organisation_id,created_by,lead_id,description,deliverables,project_type,discipline,deadline,status,submitted_at
  ) values (
    p_organisation_id,p_user_id,v_lead.id,v_submission.description,v_submission.deliverables,v_submission.project_type,
    v_submission.discipline,v_submission.deadline,'submitted',v_submission.submitted_at
  ) returning * into v_intake;

  update public.intake_sessions set lead_id=v_lead.id,status='converted',updated_at=now() where id=v_session.id;
  update public.intake_files set lead_id=v_lead.id where intake_session_id=v_session.id;

  -- Generate the first controlled publication shell from source evidence.
  v_doc_ref:=public.op_next_reference(p_organisation_id,'document',null);
  insert into public.documents(
    organisation_id,lead_id,technical_intake_id,created_by,document_type,reference,title,status,version
  ) values (
    p_organisation_id,v_lead.id,v_intake.id,p_user_id,'client-requirements',v_doc_ref,'Client Requirements','draft',1
  );

  -- This update invokes the existing inheritance trigger that moves the approved
  -- Partner Review and Partner Quote from Prospect ownership to Case ownership.
  update public.prospects
  set status='converted',converted_lead_id=v_lead.id,company_id=v_company.id,
      contact_id=case when v_contact.id is null then null else v_contact.id end,assigned_to=p_user_id,updated_at=now()
  where id=v_prospect.id;

  perform public.op_record_activity(p_organisation_id,p_user_id,'technical_intake',v_intake.id,
    'technical_intake_inherited_from_step_2',jsonb_build_object('prospectId',p_prospect_id,'sessionId',v_session.id));
  perform public.op_record_activity(p_organisation_id,p_user_id,'prospect',v_prospect.id,
    'prospect_converted',jsonb_build_object('leadId',v_lead.id,'leadReference',v_lead.reference,'companyId',v_company.id,'partnerReviewRequestId',v_review_request_id,'partnerId',v_partner_id));
  perform public.op_record_activity(p_organisation_id,p_user_id,'lead',v_lead.id,
    'case_created_from_governed_acquisition',jsonb_build_object('prospectId',v_prospect.id,'reference',v_lead.reference,'partnerReviewRequestId',v_review_request_id));
  return v_lead;
end $$;

-- ---------- Case technical basis ----------

create or replace function public.op_approve_technical_intake(
  p_organisation_id uuid,
  p_user_id uuid,
  p_intake_id uuid
) returns public.technical_intakes
language plpgsql security definer set search_path=public
as $$
declare
  v_intake public.technical_intakes;
  v_ref text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_intake from public.technical_intakes
  where organisation_id=p_organisation_id and id=p_intake_id for update;
  if not found then raise exception 'Technical intake not found.'; end if;
  if v_intake.status not in ('submitted','under_review','clarification_required','draft') then raise exception 'Technical intake is not in an approvable state.'; end if;
  if nullif(trim(v_intake.description),'') is null then raise exception 'Technical description is required.'; end if;
  if nullif(trim(coalesce(v_intake.deliverables,'')),'') is null then raise exception 'Deliverables are required.'; end if;
  if nullif(trim(coalesce(v_intake.project_type,'')),'') is null then raise exception 'Project type is required.'; end if;

  if not exists(
    select 1 from public.documents d
    where d.organisation_id=p_organisation_id and d.lead_id=v_intake.lead_id
      and d.document_type='client-requirements' and d.status::text in ('approved','issued','published')
      and d.is_current_revision=true
  ) then raise exception 'Approved Client Requirements are required before Technical Scope approval.'; end if;

  if not exists(
    select 1 from public.partner_review_requests r
    where r.organisation_id=p_organisation_id and r.lead_id=v_intake.lead_id
      and r.status::text in ('approved','approved_with_conditions')
  ) then raise exception 'OS_INTEGRITY: Case 360 is missing the approved Partner Review inherited from Acquisition.'; end if;

  update public.technical_intakes set status='approved',reviewed_by=p_user_id,reviewed_at=now(),updated_at=now()
  where id=p_intake_id returning * into v_intake;
  update public.leads set status='qualified',next_action='Approve controlled Scope of Work and Partner Technical Assessment',updated_at=now()
  where organisation_id=p_organisation_id and id=v_intake.lead_id;

  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and lead_id=v_intake.lead_id and document_type='scope-of-work' and status::text<>'superseded') then
    v_ref:=public.op_next_reference(p_organisation_id,'document',null);
    insert into public.documents(organisation_id,lead_id,technical_intake_id,created_by,document_type,reference,title,status,version)
    values(p_organisation_id,v_intake.lead_id,v_intake.id,p_user_id,'scope-of-work',v_ref,'Scope of Work','draft',1);
  end if;

  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and lead_id=v_intake.lead_id and document_type='partner-technical-assessment-report' and status::text<>'superseded') then
    v_ref:=public.op_next_reference(p_organisation_id,'document',null);
    insert into public.documents(organisation_id,lead_id,technical_intake_id,created_by,document_type,reference,title,status,version)
    values(p_organisation_id,v_intake.lead_id,v_intake.id,p_user_id,'partner-technical-assessment-report',v_ref,'Partner Technical Assessment Report','draft',1);
  end if;

  perform public.op_record_activity(p_organisation_id,p_user_id,'technical_intake',v_intake.id,
    'technical_intake_approved',jsonb_build_object('leadId',v_intake.lead_id,'canonicalLifecycle',true));
  return v_intake;
end $$;

-- Commercial Review is allowed only after the inherited partner evidence has
-- been formalised into the controlled Case technical basis.
create or replace function public.op_create_commercial_review(
  p_organisation_id uuid,
  p_user_id uuid,
  p_partner_quote_id uuid,
  p_markup_percent numeric
) returns public.commercial_reviews
language plpgsql security definer set search_path=public
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
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_markup_percent is null or p_markup_percent<0 or p_markup_percent>500 then raise exception 'Markup must be between 0 and 500.'; end if;

  select * into v_quote from public.partner_quotes
  where id=p_partner_quote_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Partner pricing not found.'; end if;
  if v_quote.lead_id is null or v_quote.prospect_id is not null then raise exception 'Commercial Review can only be created after Case 360 owns the opportunity.'; end if;
  if v_quote.status::text not in ('received','selected') or coalesce(v_quote.price,0)<=0 then raise exception 'Positive governed Partner pricing is required.'; end if;

  select * into v_request from public.partner_review_requests
  where id=v_quote.partner_review_request_id and organisation_id=p_organisation_id and lead_id=v_quote.lead_id and partner_id=v_quote.partner_id;
  if not found or v_request.status::text not in ('approved','approved_with_conditions') then raise exception 'The inherited Partner Review must be approved before commercial progression.'; end if;
  select * into v_response from public.partner_review_responses where id=v_quote.partner_review_response_id and partner_review_request_id=v_request.id;
  if not found or v_response.feasibility::text not in ('feasible','feasible_with_conditions') then raise exception 'A feasible governed Partner response is required.'; end if;
  select * into v_decision from public.partner_review_internal_decisions
  where partner_review_request_id=v_request.id and partner_review_response_id=v_response.id and decision::text in ('approved','approved_with_conditions')
  order by created_at desc limit 1;
  if not found then raise exception 'Internal Go / No-Go approval is required.'; end if;

  if not exists(select 1 from public.technical_intakes where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and status='approved') then
    raise exception 'Approved Technical Scope is required before Commercial Review.';
  end if;
  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and document_type='scope-of-work' and status::text in ('approved','issued','published') and is_current_revision=true) then
    raise exception 'Approved Scope of Work is required before Commercial Review.';
  end if;
  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and document_type='partner-technical-assessment-report' and status::text in ('approved','issued','published') and is_current_revision=true) then
    raise exception 'Approved Partner Technical Assessment is required before Commercial Review.';
  end if;
  if exists(select 1 from public.commercial_reviews where organisation_id=p_organisation_id and lead_id=v_quote.lead_id and status::text in ('draft','pending_approval','approved')) then
    raise exception 'An active Commercial Review already exists for this Case.';
  end if;

  v_cost:=v_quote.price;
  v_client_price:=round(v_cost*(1+p_markup_percent/100.0),2);
  v_margin:=round(v_client_price-v_cost,2);
  v_margin_percent:=case when v_client_price>0 then round((v_margin/v_client_price)*100.0,4) else 0 end;

  insert into public.commercial_reviews(
    organisation_id,lead_id,partner_quote_id,cost_price,client_price,margin_amount,margin_percent,status,created_by
  ) values(
    p_organisation_id,v_quote.lead_id,v_quote.id,v_cost,v_client_price,v_margin,v_margin_percent,'pending_approval',p_user_id
  ) returning * into v_review;

  update public.leads set status='pricing',next_action='Approve commercial position and generate controlled Client Quote',updated_at=now()
  where organisation_id=p_organisation_id and id=v_quote.lead_id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'lead',v_quote.lead_id,'commercial_margin_created',
    jsonb_build_object('commercialReviewId',v_review.id,'partnerQuoteId',v_quote.id,'costPrice',v_cost,'markupPercent',p_markup_percent,'clientPrice',v_client_price,'canonicalLifecycle',true));
  return v_review;
end $$;

-- The Commercial Review row is the approval authority. Quote generation creates
-- exactly one canonical controlled client-quote shell.
create or replace function public.op_approve_commercial_generate_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_review_id uuid,
  p_currency text default 'GBP',
  p_vat_rate numeric default 20
) returns public.quotes
language plpgsql security definer set search_path=public
as $$
declare
  v_review public.commercial_reviews;
  v_quote public.quotes;
  v_number text;
  v_vat numeric;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_vat_rate<0 or p_vat_rate>100 then raise exception 'VAT rate must be between 0 and 100.'; end if;
  select * into v_review from public.commercial_reviews where organisation_id=p_organisation_id and id=p_review_id for update;
  if not found then raise exception 'Commercial Review not found.'; end if;
  if v_review.status::text not in ('pending_approval','draft') then raise exception 'Commercial Review is not awaiting approval.'; end if;
  if coalesce(v_review.client_price,0)<=0 then raise exception 'Client price must be greater than zero.'; end if;
  select * into v_quote from public.quotes where organisation_id=p_organisation_id and commercial_review_id=p_review_id;
  if found then return v_quote; end if;

  update public.commercial_reviews set status='approved',approved_by=p_user_id,approved_at=now(),updated_at=now() where id=p_review_id;
  v_number:=public.op_next_reference(p_organisation_id,'quote',1);
  v_vat:=round((v_review.client_price*p_vat_rate/100.0)::numeric,2);
  insert into public.quotes(organisation_id,created_by,lead_id,commercial_review_id,quote_number,revision,status,subtotal,vat,total,currency)
  values(p_organisation_id,p_user_id,v_review.lead_id,v_review.id,v_number,1,'draft',v_review.client_price,v_vat,v_review.client_price+v_vat,upper(p_currency))
  returning * into v_quote;

  insert into public.documents(organisation_id,lead_id,quote_id,created_by,document_type,reference,title,status,version)
  values(p_organisation_id,v_review.lead_id,v_quote.id,p_user_id,'client-quote',v_number,'Client Quote '||v_number,'draft',1)
  on conflict (organisation_id,reference) do nothing;

  update public.leads set status='pricing',next_action='Approve controlled Client Quote for issue',updated_at=now()
  where organisation_id=p_organisation_id and id=v_review.lead_id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'quote',v_quote.id,'client_quote_generated',
    jsonb_build_object('commercialReviewId',p_review_id,'vatRate',p_vat_rate,'documentType','client-quote','canonicalLifecycle',true));
  return v_quote;
end $$;

-- ---------- Client acceptance is evidence, not a button state ----------

create or replace function public.op_guard_project_client_acceptance()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.quote_id is not null and not exists(
    select 1 from public.quote_acceptance_records a
    where a.organisation_id=new.organisation_id and a.quote_id=new.quote_id
  ) then
    raise exception 'OS_INTEGRITY: Project 360 requires recorded written client acceptance evidence.';
  end if;
  return new;
end $$;

drop trigger if exists trg_op_guard_project_client_acceptance on public.projects;
create trigger trg_op_guard_project_client_acceptance
before insert on public.projects
for each row execute function public.op_guard_project_client_acceptance();

create or replace function public.op_accept_quote_create_project_with_acceptance(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_acceptance_basis text,
  p_evidence_reference text,
  p_accepted_by_name text,
  p_accepted_by_email text default null,
  p_notes text default null
) returns public.projects
language plpgsql security definer set search_path=public
as $$
declare
  v_quote public.quotes;
  v_lead public.leads;
  v_project public.projects;
  v_number text;
  v_stw_ref text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_acceptance_basis not in ('signed_quote','purchase_order','email_confirmation','client_portal','other_written') then raise exception 'Select a valid written acceptance basis.'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'Acceptance evidence reference is required.'; end if;
  if nullif(trim(coalesce(p_accepted_by_name,'')),'') is null then raise exception 'Client acceptance name is required.'; end if;

  select * into v_quote from public.quotes where organisation_id=p_organisation_id and id=p_quote_id for update;
  if not found then raise exception 'Quote not found.'; end if;
  select * into v_project from public.projects where organisation_id=p_organisation_id and quote_id=p_quote_id;
  if found then return v_project; end if;
  if v_quote.status::text <> 'issued' then raise exception 'Only an issued Quote can be accepted.'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until<current_date then raise exception 'Quote has expired.'; end if;
  if not exists(select 1 from public.documents where organisation_id=p_organisation_id and quote_id=p_quote_id and document_type='client-quote' and status::text in ('issued','published') and is_current_revision=true) then
    raise exception 'The controlled Client Quote must be issued before acceptance can create a Project.';
  end if;

  select * into v_lead from public.leads where organisation_id=p_organisation_id and id=v_quote.lead_id;
  if not found then raise exception 'Case 360 record not found.'; end if;

  insert into public.quote_acceptance_records(
    organisation_id,quote_id,lead_id,acceptance_basis,evidence_reference,accepted_by_name,accepted_by_email,notes,recorded_by
  ) values(
    p_organisation_id,v_quote.id,v_quote.lead_id,p_acceptance_basis,trim(p_evidence_reference),trim(p_accepted_by_name),nullif(trim(coalesce(p_accepted_by_email,'')),''),nullif(trim(coalesce(p_notes,'')),''),p_user_id
  );

  update public.quotes set status='accepted',accepted_at=now(),updated_at=now() where id=p_quote_id;
  update public.leads set status='won',next_action='Project 360 owns delivery',updated_at=now() where organisation_id=p_organisation_id and id=v_quote.lead_id;

  v_number:=public.op_next_reference(p_organisation_id,'project',null);
  insert into public.projects(organisation_id,created_by,project_manager_id,lead_id,quote_id,project_number,title,status,start_date,notes,project_stage)
  values(p_organisation_id,p_user_id,p_user_id,v_quote.lead_id,v_quote.id,v_number,
    coalesce(nullif(v_lead.title,''),v_lead.company_name||' engineering project'),'planning',current_date,v_lead.notes,'mobilisation')
  returning * into v_project;

  -- Transfer the controlled delivery boundary to Project ownership.
  update public.documents
  set project_id=v_project.id,lead_id=null,quote_id=coalesce(quote_id,v_quote.id),updated_at=now()
  where organisation_id=p_organisation_id and lead_id=v_quote.lead_id
    and document_type='scope-of-work' and status::text in ('approved','issued','published') and is_current_revision=true;

  v_stw_ref:=public.op_next_reference(p_organisation_id,'document',null);
  insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
  select p_organisation_id,v_project.id,v_quote.id,p_user_id,'statement-of-work',v_stw_ref,'Statement of Work','draft',1
  where not exists(select 1 from public.documents where organisation_id=p_organisation_id and project_id=v_project.id and document_type='statement-of-work' and status::text<>'superseded');

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',v_project.id,'project_created_from_governed_client_acceptance',
    jsonb_build_object('quoteId',p_quote_id,'acceptanceBasis',p_acceptance_basis,'evidenceReference',trim(p_evidence_reference),'canonicalLifecycle',true));
  return v_project;
end $$;

-- Disable the historical no-evidence Project creation RPC. The insert trigger is
-- a second line of defence if a stale caller attempts to bypass this function.
create or replace function public.op_accept_quote_create_project(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid
) returns public.projects
language plpgsql security definer set search_path=public
as $$
begin
  raise exception 'OS_INTEGRITY: Use governed client acceptance evidence before creating Project 360.';
end $$;

-- ---------- Execution Partner lineage / controlled release ----------

create or replace function public.op_guard_project_execution_assignment()
returns trigger language plpgsql set search_path=public as $$
declare
  v_commercial_partner_id uuid;
  v_partner public.partners;
  v_doc public.documents;
begin
  select pq.partner_id into v_commercial_partner_id
  from public.projects p
  join public.quotes q on q.id=p.quote_id
  join public.commercial_reviews cr on cr.id=q.commercial_review_id
  join public.partner_quotes pq on pq.id=cr.partner_quote_id
  where p.id=new.project_id and p.organisation_id=new.organisation_id;
  if v_commercial_partner_id is null then raise exception 'OS_INTEGRITY: Project has no commercially selected Execution Partner lineage.'; end if;
  if new.partner_id is distinct from v_commercial_partner_id then raise exception 'Execution Partner must match the Partner approved in the accepted commercial position.'; end if;

  select * into v_partner from public.partners where id=new.partner_id and organisation_id=new.organisation_id;
  if not found or v_partner.status<>'approved' or not coalesce(v_partner.nda_signed,false) then raise exception 'Execution Partner must be approved and NDA-ready.'; end if;
  if new.scope_document_id is null then raise exception 'An approved controlled execution scope is required before Partner release.'; end if;
  select * into v_doc from public.documents where id=new.scope_document_id and organisation_id=new.organisation_id and project_id=new.project_id;
  if not found or v_doc.document_type not in ('scope-of-work','statement-of-work') or v_doc.status::text not in ('approved','issued','published') or not v_doc.is_current_revision then
    raise exception 'Execution release must link the current approved Scope of Work or Statement of Work.';
  end if;
  return new;
end $$;

drop trigger if exists trg_op_guard_project_execution_assignment on public.project_execution_assignments;
create trigger trg_op_guard_project_execution_assignment
before insert or update of project_id,partner_id,scope_document_id on public.project_execution_assignments
for each row execute function public.op_guard_project_execution_assignment();

create or replace function public.op_guard_partner_delivery_cycle()
returns trigger language plpgsql set search_path=public as $$
declare
  v_assignment public.project_execution_assignments;
  v_stage text;
begin
  select * into v_assignment from public.project_execution_assignments where id=new.assignment_id;
  if not found then raise exception 'Execution assignment not found.'; end if;
  if not exists(select 1 from public.partner_commencement_declarations where assignment_id=v_assignment.id) then raise exception 'Partner commencement must be declared before delivery submission.'; end if;
  select project_stage into v_stage from public.projects where id=v_assignment.project_id;
  if v_stage not in ('in_progress','partner_correction') then raise exception 'Partner delivery may be submitted only during execution or correction.'; end if;
  new.execution_cycle:=v_assignment.execution_cycle;
  return new;
end $$;

drop trigger if exists trg_op_guard_partner_delivery_cycle on public.partner_delivery_submissions;
create trigger trg_op_guard_partner_delivery_cycle
before insert on public.partner_delivery_submissions
for each row execute function public.op_guard_partner_delivery_cycle();

-- ---------- One authoritative Project readiness function ----------

create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare
  p public.projects;
  v_stage text;
  v_ready boolean:=false;
  v_reasons jsonb:='[]'::jsonb;
  v_task_total integer:=0;
  v_task_open integer:=0;
  v_delivery_total integer:=0;
  v_delivery_work_open integer:=0;
  v_delivery_close_open integer:=0;
  v_delivery_internal_block integer:=0;
  v_delivery_client_block integer:=0;
  v_open_exceptions integer:=0;
  v_assignment_id uuid;
  v_assignment_partner_id uuid;
  v_execution_cycle integer:=1;
  v_partner_commenced boolean:=false;
  v_commercial_partner_id uuid;
  v_current_submission_id uuid;
  v_current_submission_review text;
  v_scope_ready boolean:=false;
  v_statement_ready boolean:=false;
  v_technical_review_ready boolean:=false;
  v_register_ready boolean:=false;
  v_handover_issued boolean:=false;
  v_completion_issued boolean:=false;
  v_transmittal_count integer:=0;
  v_client_outcome text;
  v_open_receivables integer:=0;
  v_open_payables integer:=0;
  v_financial jsonb;
begin
  select * into p from public.projects where id=p_project_id;
  if not found then return jsonb_build_object('ready',false,'reasons',jsonb_build_array('Project not found.')); end if;
  v_stage:=coalesce(p.project_stage,'mobilisation');

  select count(*),count(*) filter(where status not in ('completed','cancelled')) into v_task_total,v_task_open
  from public.tasks where organisation_id=p.organisation_id and entity_type='project' and entity_id=p.id;

  select count(*),
         count(*) filter(where status in ('not_started','in_progress','blocked')),
         count(*) filter(where status not in ('complete','cancelled')),
         count(*) filter(where internal_review_status in ('pending','changes_required')),
         count(*) filter(where client_review_status in ('pending','changes_required'))
  into v_delivery_total,v_delivery_work_open,v_delivery_close_open,v_delivery_internal_block,v_delivery_client_block
  from public.project_delivery_items where organisation_id=p.organisation_id and project_id=p.id;

  select count(*) into v_open_exceptions from public.partner_execution_exceptions
  where organisation_id=p.organisation_id and project_id=p.id and status in ('open','acknowledged');

  select a.id,a.partner_id,a.execution_cycle into v_assignment_id,v_assignment_partner_id,v_execution_cycle
  from public.project_execution_assignments a
  where a.organisation_id=p.organisation_id and a.project_id=p.id and a.execution_state not in ('closed','cancelled')
  order by a.created_at desc limit 1;

  select pq.partner_id into v_commercial_partner_id
  from public.quotes q
  join public.commercial_reviews cr on cr.id=q.commercial_review_id
  join public.partner_quotes pq on pq.id=cr.partner_quote_id
  where q.id=p.quote_id;

  if v_assignment_id is not null then
    select exists(select 1 from public.partner_commencement_declarations where assignment_id=v_assignment_id) into v_partner_commenced;
    select s.id,s.review_status into v_current_submission_id,v_current_submission_review
    from public.partner_delivery_submissions s
    where s.assignment_id=v_assignment_id and s.execution_cycle=v_execution_cycle
    order by s.submitted_at desc limit 1;
  end if;

  select exists(select 1 from public.documents where project_id=p.id and document_type='scope-of-work' and status::text in ('approved','issued','published') and is_current_revision=true) into v_scope_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='statement-of-work' and status::text in ('approved','issued','published') and is_current_revision=true) into v_statement_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='technical-review' and status::text in ('approved','issued','published') and is_current_revision=true) into v_technical_review_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='document-register' and status::text in ('approved','issued','published') and is_current_revision=true) into v_register_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='handover-pack' and status::text in ('issued','published') and is_current_revision=true) into v_handover_issued;
  select exists(select 1 from public.documents where project_id=p.id and document_type='completion-report' and status::text in ('issued','published') and is_current_revision=true) into v_completion_issued;

  select count(*) into v_transmittal_count from public.project_client_transmittals where organisation_id=p.organisation_id and project_id=p.id;
  select outcome into v_client_outcome from public.project_client_reviews where organisation_id=p.organisation_id and project_id=p.id order by recorded_at desc limit 1;

  if v_stage='mobilisation' then
    if p.quote_id is null then v_reasons:=v_reasons||jsonb_build_array('Accepted Quote is not linked.'); end if;
    if p.quote_id is not null and not exists(select 1 from public.quote_acceptance_records where organisation_id=p.organisation_id and quote_id=p.quote_id) then v_reasons:=v_reasons||jsonb_build_array('Written client acceptance evidence is required.'); end if;
    if p.project_manager_id is null then v_reasons:=v_reasons||jsonb_build_array('Project manager is not assigned.'); end if;
    if p.start_date is null then v_reasons:=v_reasons||jsonb_build_array('Start date is not recorded.'); end if;
    if p.due_date is null then v_reasons:=v_reasons||jsonb_build_array('Due date is not recorded.'); end if;
    if not v_scope_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Scope of Work is required.'); end if;
    if not v_statement_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Statement of Work is required.'); end if;
    if v_commercial_partner_id is null then v_reasons:=v_reasons||jsonb_build_array('Commercial Execution Partner lineage is missing.');
    elsif v_assignment_id is null then v_reasons:=v_reasons||jsonb_build_array('Execution Partner assignment is required before authorisation.');
    elsif v_assignment_partner_id is distinct from v_commercial_partner_id then v_reasons:=v_reasons||jsonb_build_array('Execution Partner does not match the commercially approved Partner.'); end if;
    v_financial:=public.op_project_financial_gate(p.id);
    if not coalesce((v_financial->>'authorised')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array('Financial authorisation: '||coalesce(v_financial->>'reason','Commercial authorisation is incomplete.')); end if;

  elsif v_stage='ready_for_execution' then
    if not v_scope_ready or not v_statement_ready then v_reasons:=v_reasons||jsonb_build_array('Approved execution scope is required.'); end if;
    if v_assignment_id is null then v_reasons:=v_reasons||jsonb_build_array('Execution Partner assignment is required.');
    elsif not v_partner_commenced then v_reasons:=v_reasons||jsonb_build_array('Execution Partner commencement declaration is required.'); end if;

  elsif v_stage='in_progress' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array(v_open_exceptions||' open Execution Partner exception(s) must be resolved.'); end if;
    if v_delivery_work_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_work_open||' Delivery Control item(s) are still in active/blocked work states.'); end if;
    if v_assignment_id is not null then
      if v_current_submission_id is null or coalesce(v_current_submission_review,'') not in ('submitted','under_review','accepted') then
        v_reasons:=v_reasons||jsonb_build_array('A current-cycle Execution Partner delivery submission is required before Internal Review.');
      end if;
    else
      if v_task_total=0 then v_reasons:=v_reasons||jsonb_build_array('At least one internal delivery activity is required.'); end if;
      if v_task_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_task_open||' internal delivery activity(ies) remain open.'); end if;
    end if;

  elsif v_stage='internal_review' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('Open Execution Partner exceptions must be resolved before client release.'); end if;
    if v_assignment_id is not null and (v_current_submission_id is null or coalesce(v_current_submission_review,'') not in ('submitted','under_review')) then v_reasons:=v_reasons||jsonb_build_array('Current-cycle Partner delivery is not in Internal Review.'); end if;
    if v_delivery_internal_block>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_internal_block||' Delivery Control item(s) still require internal review action.'); end if;
    if not v_technical_review_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Technical Review is required.'); end if;
    if not v_register_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Document Register is required.'); end if;

  elsif v_stage='partner_correction' then
    if v_assignment_id is null then v_reasons:=v_reasons||jsonb_build_array('Active Execution Partner assignment is required for correction.'); end if;

  elsif v_stage='ready_for_client_issue' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('Open Execution Partner exceptions must be resolved before client issue.'); end if;
    if not v_handover_issued then v_reasons:=v_reasons||jsonb_build_array('Issued Handover Pack is required before client transmittal.'); end if;
    if v_transmittal_count=0 then v_reasons:=v_reasons||jsonb_build_array('Client transmittal record is required.'); end if;

  elsif v_stage='issued_to_client' then
    if v_transmittal_count=0 then v_reasons:=v_reasons||jsonb_build_array('Client transmittal record is missing.'); end if;

  elsif v_stage='client_review' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('Open execution exceptions must be resolved.'); end if;
    if v_delivery_client_block>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_client_block||' Delivery Control item(s) still require client-review resolution.'); end if;
    if v_client_outcome is null then v_reasons:=v_reasons||jsonb_build_array('Client Review outcome is required.');
    elsif v_client_outcome not in ('accepted','accepted_with_comments') then v_reasons:=v_reasons||jsonb_build_array('Client changes require a governed correction cycle.'); end if;

  elsif v_stage='completion' then
    if v_client_outcome not in ('accepted','accepted_with_comments') then v_reasons:=v_reasons||jsonb_build_array('Accepted Client Review outcome is required before closure.'); end if;
    if not v_completion_issued then v_reasons:=v_reasons||jsonb_build_array('Issued Completion Report is required.'); end if;
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('All Execution Partner exceptions must be resolved.'); end if;
    if v_delivery_close_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_close_open||' Delivery Control item(s) remain unresolved.'); end if;
    if v_task_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_task_open||' delivery activity(ies) remain open.'); end if;
    select count(*) into v_open_receivables from public.invoices where organisation_id=p.organisation_id and project_id=p.id and status::text not in ('cancelled','refunded') and coalesce(amount_paid,0)<coalesce(total,0);
    select count(*) into v_open_payables from public.partner_payables where organisation_id=p.organisation_id and project_id=p.id and status::text not in ('cancelled','disputed') and coalesce(amount_paid,0)<coalesce(total,0);
    if v_open_receivables>0 then v_reasons:=v_reasons||jsonb_build_array(v_open_receivables||' client receivable(s) remain outstanding.'); end if;
    if v_open_payables>0 then v_reasons:=v_reasons||jsonb_build_array(v_open_payables||' Partner payable(s) remain outstanding.'); end if;
  end if;

  v_ready:=jsonb_array_length(v_reasons)=0;
  return jsonb_build_object(
    'ready',v_ready,'stage',v_stage,'reasons',v_reasons,
    'activityTotal',v_task_total,'activityOpen',v_task_open,
    'deliveryItems',v_delivery_total,'deliveryWorkOpen',v_delivery_work_open,'deliveryCloseOpen',v_delivery_close_open,
    'openPartnerExceptions',v_open_exceptions,
    'executionMode',case when v_assignment_id is null then 'internal' else 'partner' end,
    'executionCycle',v_execution_cycle,'partnerCommencement',v_partner_commenced,
    'currentPartnerSubmissionId',v_current_submission_id,'currentPartnerSubmissionReview',v_current_submission_review,
    'clientTransmittals',v_transmittal_count,'clientOutcome',v_client_outcome
  );
end $$;

-- ---------- One transition engine; no duplicate competing stage gates ----------

create or replace function public.op_advance_project_stage(
  p_project_id uuid,
  p_target_stage text,
  p_actor_id uuid,
  p_note text default null
) returns public.projects
language plpgsql set search_path=public
as $$
declare
  v_project public.projects;
  v_current_stage text;
  v_allowed boolean:=false;
  v_correction_route boolean:=false;
  v_correction_return boolean:=false;
  v_readiness jsonb;
  v_reason text;
  v_status public.project_status;
  v_assignment public.project_execution_assignments;
  v_ref text;
begin
  select * into v_project from public.projects where id=p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;
  v_current_stage:=coalesce(v_project.project_stage,'mobilisation');

  v_allowed:=case v_current_stage
    when 'mobilisation' then p_target_stage='ready_for_execution'
    when 'ready_for_execution' then p_target_stage='in_progress'
    when 'in_progress' then p_target_stage='internal_review'
    when 'internal_review' then p_target_stage in ('partner_correction','ready_for_client_issue')
    when 'partner_correction' then p_target_stage='in_progress'
    when 'ready_for_client_issue' then p_target_stage='issued_to_client'
    when 'issued_to_client' then p_target_stage='client_review'
    when 'client_review' then p_target_stage in ('completion','partner_correction')
    when 'completion' then p_target_stage='closed'
    else false end;
  if not v_allowed then raise exception 'Transition from % to % is not permitted.',v_current_stage,p_target_stage; end if;

  v_correction_route:=v_current_stage in ('internal_review','client_review') and p_target_stage='partner_correction';
  v_correction_return:=v_current_stage='partner_correction' and p_target_stage='in_progress';

  if not v_correction_route and not v_correction_return then
    v_readiness:=public.op_project_stage_readiness(v_project.id);
    if not coalesce((v_readiness->>'ready')::boolean,false) then
      select string_agg(value,'; ') into v_reason from jsonb_array_elements_text(v_readiness->'reasons') as r(value);
      raise exception 'Current project gate is blocked: %',coalesce(v_reason,'required governed evidence is incomplete.');
    end if;
  end if;

  select * into v_assignment from public.project_execution_assignments
  where project_id=v_project.id and execution_state not in ('closed','cancelled') order by created_at desc limit 1 for update;

  if p_target_stage='internal_review' then
    if v_assignment.id is not null then
      update public.partner_delivery_submissions set review_status='under_review'
      where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='technical-review' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'technical-review',v_ref,'Technical Review','draft',1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='document-register' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'document-register',v_ref,'Document Register','draft',1);
    end if;
  end if;

  if p_target_stage='partner_correction' and v_assignment.id is not null then
    update public.partner_delivery_submissions set review_status='changes_requested'
    where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    update public.project_execution_assignments set execution_cycle=execution_cycle+1,execution_state='executing',updated_at=now() where id=v_assignment.id;
  end if;

  if p_target_stage='ready_for_client_issue' then
    if v_assignment.id is not null then
      update public.partner_delivery_submissions set review_status='accepted'
      where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='handover-pack' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'handover-pack',v_ref,'Handover Pack','draft',1);
    end if;
  end if;

  if p_target_stage='completion' and not exists(select 1 from public.documents where project_id=v_project.id and document_type='completion-report' and status::text<>'superseded') then
    v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
    insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
    values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'completion-report',v_ref,'Completion Report','draft',1);
  end if;

  if p_target_stage='closed' and v_assignment.id is not null then
    update public.project_execution_assignments set execution_state='closed',updated_at=now() where id=v_assignment.id;
  end if;

  v_status:=case p_target_stage
    when 'ready_for_execution' then 'planning'::public.project_status
    when 'in_progress' then 'active'::public.project_status
    when 'internal_review' then 'review'::public.project_status
    when 'partner_correction' then 'waiting'::public.project_status
    when 'ready_for_client_issue' then 'review'::public.project_status
    when 'issued_to_client' then 'waiting'::public.project_status
    when 'client_review' then 'waiting'::public.project_status
    when 'completion' then 'completed'::public.project_status
    when 'closed' then 'closed'::public.project_status end;

  update public.projects
  set project_stage=p_target_stage,status=v_status,
      notes=case when nullif(trim(coalesce(p_note,'')),'') is null then notes when notes is null or trim(notes)='' then trim(p_note) else notes||E'\n\nStage note: '||trim(p_note) end,
      updated_at=now()
  where id=v_project.id returning * into v_project;

  insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,old_value,new_value,event_data)
  values(v_project.organisation_id,'project',v_project.id,p_actor_id,'project.stage_advanced',
    jsonb_build_object('project_stage',v_current_stage),jsonb_build_object('project_stage',p_target_stage,'status',v_status::text),
    jsonb_build_object('note',nullif(trim(coalesce(p_note,'')) ,''),'canonicalLifecycle',true));
  return v_project;
end $$;

-- ---------- Controlled client transmittal and review outcome ----------

create or replace function public.op_record_client_transmittal_and_issue(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_recipient_name text,
  p_recipient_email text,
  p_delivery_method text,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_project public.projects;
  v_ref text;
  v_manifest jsonb;
  v_transmittal public.project_client_transmittals;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_delivery_method not in ('email','secure_link','client_portal','other') then raise exception 'Select a valid client delivery method.'; end if;
  if nullif(trim(coalesce(p_recipient_name,'')),'') is null then raise exception 'Client recipient name is required.'; end if;
  select * into v_project from public.projects where id=p_project_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Project not found.'; end if;
  if v_project.project_stage<>'ready_for_client_issue' then raise exception 'Client transmittal can only be recorded at Ready for client issue.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('documentId',id,'reference',reference,'title',title,'revision',revision_code,'status',status::text) order by reference),'[]'::jsonb)
  into v_manifest from public.documents
  where organisation_id=p_organisation_id and project_id=p_project_id and status::text in ('issued','published') and is_current_revision=true;
  if jsonb_array_length(v_manifest)=0 then raise exception 'At least one issued controlled document is required for client transmittal.'; end if;

  v_ref:='OP-TX-'||v_project.project_number||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.project_client_transmittals(
    organisation_id,project_id,transmittal_reference,recipient_name,recipient_email,delivery_method,document_manifest,note,issued_by
  ) values(
    p_organisation_id,p_project_id,v_ref,trim(p_recipient_name),nullif(trim(coalesce(p_recipient_email,'')),''),p_delivery_method,v_manifest,nullif(trim(coalesce(p_note,'')),''),p_user_id
  ) returning * into v_transmittal;

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',p_project_id,'client_transmittal_recorded',
    jsonb_build_object('transmittalId',v_transmittal.id,'reference',v_ref,'recipientName',trim(p_recipient_name),'deliveryMethod',p_delivery_method,'documentManifest',v_manifest));
  perform public.op_advance_project_stage(p_project_id,'issued_to_client',p_user_id,'Controlled client transmittal '||v_ref||' recorded.');
  return jsonb_build_object('transmittal',to_jsonb(v_transmittal),'projectStage','issued_to_client');
end $$;

create or replace function public.op_record_client_review_outcome(
  p_organisation_id uuid,
  p_user_id uuid,
  p_project_id uuid,
  p_outcome text,
  p_evidence_basis text,
  p_evidence_reference text,
  p_comments text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_project public.projects;
  v_transmittal_id uuid;
  v_review public.project_client_reviews;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_outcome not in ('accepted','accepted_with_comments','changes_requested','rejected') then raise exception 'Select a valid Client Review outcome.'; end if;
  if p_evidence_basis not in ('email_confirmation','signed_acceptance','client_portal','meeting_record','other_written') then raise exception 'Select a valid Client Review evidence basis.'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'Client Review evidence reference is required.'; end if;
  select * into v_project from public.projects where id=p_project_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Project not found.'; end if;
  if v_project.project_stage<>'client_review' then raise exception 'Client Review outcome can only be recorded during Client Review.'; end if;
  select id into v_transmittal_id from public.project_client_transmittals where organisation_id=p_organisation_id and project_id=p_project_id order by issued_at desc limit 1;
  if v_transmittal_id is null then raise exception 'Client transmittal evidence is required before Client Review outcome.'; end if;

  insert into public.project_client_reviews(organisation_id,project_id,transmittal_id,outcome,evidence_basis,evidence_reference,comments,recorded_by)
  values(p_organisation_id,p_project_id,v_transmittal_id,p_outcome,p_evidence_basis,trim(p_evidence_reference),nullif(trim(coalesce(p_comments,'')),''),p_user_id)
  returning * into v_review;
  perform public.op_record_activity(p_organisation_id,p_user_id,'project',p_project_id,'client_review_outcome_recorded',
    jsonb_build_object('clientReviewId',v_review.id,'outcome',p_outcome,'evidenceBasis',p_evidence_basis,'evidenceReference',trim(p_evidence_reference)));

  if p_outcome in ('changes_requested','rejected') then
    perform public.op_advance_project_stage(p_project_id,'partner_correction',p_user_id,'Client Review requires correction: '||trim(p_evidence_reference));
    return jsonb_build_object('review',to_jsonb(v_review),'projectStage','partner_correction');
  end if;
  return jsonb_build_object('review',to_jsonb(v_review),'projectStage','client_review');
end $$;

create or replace function public.op_resolve_partner_execution_exception(
  p_organisation_id uuid,
  p_user_id uuid,
  p_exception_id uuid,
  p_resolution_note text
) returns public.partner_execution_exceptions
language plpgsql security definer set search_path=public
as $$
declare
  v_exception public.partner_execution_exceptions;
  v_assignment public.project_execution_assignments;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if nullif(trim(coalesce(p_resolution_note,'')),'') is null then raise exception 'Resolution note is required.'; end if;
  select * into v_exception from public.partner_execution_exceptions where id=p_exception_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Execution exception not found.'; end if;
  if v_exception.status not in ('open','acknowledged') then raise exception 'This execution exception is already resolved or withdrawn.'; end if;
  update public.partner_execution_exceptions set status='resolved',resolved_at=now(),resolution_note=trim(p_resolution_note),updated_at=now()
  where id=v_exception.id returning * into v_exception;

  select * into v_assignment from public.project_execution_assignments where id=v_exception.assignment_id for update;
  if found and not exists(select 1 from public.partner_execution_exceptions where assignment_id=v_assignment.id and status in ('open','acknowledged')) then
    update public.project_execution_assignments
    set execution_state=case when exists(select 1 from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle) then 'delivery_submitted' else 'executing' end,
        updated_at=now()
    where id=v_assignment.id;
  end if;
  perform public.op_record_activity(p_organisation_id,p_user_id,'project',v_exception.project_id,'partner_execution.exception_resolved',
    jsonb_build_object('exceptionId',v_exception.id,'resolutionNote',trim(p_resolution_note)));
  return v_exception;
end $$;

grant execute on function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.op_record_client_transmittal_and_issue(uuid,uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.op_record_client_review_outcome(uuid,uuid,uuid,text,text,text,text) to authenticated;
grant execute on function public.op_resolve_partner_execution_exception(uuid,uuid,uuid,text) to authenticated;

commit;
