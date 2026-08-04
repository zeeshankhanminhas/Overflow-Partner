-- Business Logic Conformance Sprint
-- Stage gates, partner compliance, transactional transitions,
-- OPDS references, structured prospect conversion and unified audit trail.

begin;

alter table public.prospects add column if not exists project_type text;
alter table public.prospects add column if not exists requirement_summary text;
alter table public.prospects add column if not exists website_submission_id text;

create table if not exists public.op_reference_counters (
  organisation_id uuid not null,
  reference_type text not null,
  reference_year integer not null,
  last_number integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organisation_id, reference_type, reference_year)
);

alter table public.op_reference_counters enable row level security;

drop policy if exists op_reference_counters_org_access on public.op_reference_counters;
create policy op_reference_counters_org_access on public.op_reference_counters
for all using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.organisation_id = op_reference_counters.organisation_id
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.organisation_id = op_reference_counters.organisation_id
  )
);

create or replace function public.op_assert_membership(p_organisation_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_user_id and organisation_id = p_organisation_id and is_active = true
  ) then
    raise exception 'User is not an active member of this organisation.';
  end if;
end;
$$;

create or replace function public.op_record_activity(
  p_organisation_id uuid,
  p_user_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_event_type text,
  p_event_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);
  insert into public.activity_events (
    organisation_id, entity_type, entity_id, user_id, event_type, event_data
  ) values (
    p_organisation_id, p_entity_type, p_entity_id, p_user_id, p_event_type, coalesce(p_event_data, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.op_next_reference(
  p_organisation_id uuid,
  p_reference_type text,
  p_revision integer default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_number integer;
  v_prefix text;
  v_reference text;
begin
  if p_reference_type not in ('lead','quote','project','document','drawing') then
    raise exception 'Unsupported reference type: %', p_reference_type;
  end if;

  insert into public.op_reference_counters (organisation_id, reference_type, reference_year, last_number)
  values (p_organisation_id, p_reference_type, v_year, 1)
  on conflict (organisation_id, reference_type, reference_year)
  do update set last_number = public.op_reference_counters.last_number + 1, updated_at = now()
  returning last_number into v_number;

  v_prefix := case p_reference_type
    when 'lead' then 'OP-LEAD'
    when 'quote' then 'OP-Q'
    when 'project' then 'OP-PRJ'
    when 'document' then 'OP-DOC'
    when 'drawing' then 'OP-DRG'
  end;

  v_reference := format('%s-%s-%s', v_prefix, v_year, lpad(v_number::text, 4, '0'));
  if p_reference_type in ('quote','drawing') then
    v_reference := v_reference || format('-R%s', lpad(coalesce(p_revision, 1)::text, 2, '0'));
  end if;
  return v_reference;
end;
$$;

create unique index if not exists ux_technical_intakes_org_lead
  on public.technical_intakes (organisation_id, lead_id);
create unique index if not exists ux_commercial_reviews_org_partner_quote
  on public.commercial_reviews (organisation_id, partner_quote_id)
  where partner_quote_id is not null;
create unique index if not exists ux_projects_org_quote
  on public.projects (organisation_id, quote_id)
  where quote_id is not null;
create unique index if not exists ux_documents_org_reference
  on public.documents (organisation_id, reference);

create or replace function public.op_approve_technical_intake(
  p_organisation_id uuid,
  p_user_id uuid,
  p_intake_id uuid
) returns public.technical_intakes
language plpgsql
security definer
set search_path = public
as $$
declare v_intake public.technical_intakes;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);
  select * into v_intake from public.technical_intakes
  where organisation_id = p_organisation_id and id = p_intake_id
  for update;
  if not found then raise exception 'Technical intake not found.'; end if;
  if v_intake.status not in ('submitted','under_review','clarification_required') then
    raise exception 'Technical intake must be submitted or under review before approval.';
  end if;
  if nullif(trim(v_intake.description), '') is null then raise exception 'Technical description is required.'; end if;
  if nullif(trim(coalesce(v_intake.deliverables,'')), '') is null then raise exception 'Deliverables are required.'; end if;
  if nullif(trim(coalesce(v_intake.project_type,'')), '') is null then raise exception 'Project type is required.'; end if;

  update public.technical_intakes set status='approved', reviewed_by=p_user_id, reviewed_at=now()
  where id=p_intake_id returning * into v_intake;
  update public.leads set status='partner_review' where organisation_id=p_organisation_id and id=v_intake.lead_id;

  insert into public.tasks (organisation_id, created_by, assigned_to, entity_type, entity_id, title, description, priority, status)
  select p_organisation_id, p_user_id, p_user_id, 'lead', v_intake.lead_id,
    'Select compliant partner and obtain pricing',
    'Use only an approved, active partner with NDA coverage.', 'high', 'open'
  where not exists (
    select 1 from public.tasks where organisation_id=p_organisation_id and entity_type='lead'
      and entity_id=v_intake.lead_id and title='Select compliant partner and obtain pricing'
      and status not in ('completed','cancelled')
  );

  perform public.op_record_activity(p_organisation_id,p_user_id,'technical_intake',v_intake.id,
    'technical_intake_approved',jsonb_build_object('leadId',v_intake.lead_id));
  return v_intake;
end;
$$;

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
  v_pq public.partner_quotes;
  v_partner public.partners;
  v_intake public.technical_intakes;
  v_review public.commercial_reviews;
  v_client_price numeric;
  v_margin numeric;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_markup_percent < 0 or p_markup_percent > 500 then raise exception 'Markup must be between 0 and 500 percent.'; end if;

  select * into v_pq from public.partner_quotes where organisation_id=p_organisation_id and id=p_partner_quote_id for update;
  if not found then raise exception 'Partner quote not found.'; end if;
  if v_pq.status <> 'received' then raise exception 'Only a received partner quote can be selected.'; end if;
  if v_pq.valid_until is not null and v_pq.valid_until < current_date then raise exception 'Partner quote has expired.'; end if;

  select * into v_partner from public.partners where organisation_id=p_organisation_id and id=v_pq.partner_id;
  if not found or v_partner.status <> 'approved' then raise exception 'Partner must be approved.'; end if;
  if not coalesce(v_partner.nda_signed,false) then raise exception 'Partner NDA must be signed.'; end if;

  select * into v_intake from public.technical_intakes
  where organisation_id=p_organisation_id and lead_id=v_pq.lead_id order by created_at desc limit 1;
  if not found or v_intake.status <> 'approved' then raise exception 'Technical intake must be approved before partner selection.'; end if;

  select * into v_review from public.commercial_reviews
  where organisation_id=p_organisation_id and partner_quote_id=p_partner_quote_id;
  if found then return v_review; end if;

  v_client_price := round((v_pq.price * (1 + p_markup_percent/100.0))::numeric,2);
  v_margin := round((v_client_price-v_pq.price)::numeric,2);
  insert into public.commercial_reviews (
    organisation_id, created_by, lead_id, partner_quote_id, cost_price, client_price,
    margin_amount, margin_percent, status
  ) values (
    p_organisation_id,p_user_id,v_pq.lead_id,v_pq.id,v_pq.price,v_client_price,v_margin,
    case when v_client_price>0 then round((v_margin/v_client_price*100)::numeric,2) else 0 end,
    'pending_approval'
  ) returning * into v_review;

  update public.partner_quotes set status='selected' where id=v_pq.id;
  update public.leads set status='pricing' where organisation_id=p_organisation_id and id=v_pq.lead_id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'commercial_review',v_review.id,
    'commercial_review_generated',jsonb_build_object('partnerQuoteId',v_pq.id,'markupPercent',p_markup_percent));
  return v_review;
end;
$$;

create or replace function public.op_approve_commercial_generate_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_review_id uuid,
  p_currency text default 'GBP',
  p_vat_rate numeric default 20
) returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
declare v_review public.commercial_reviews; v_quote public.quotes; v_number text; v_vat numeric;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_vat_rate < 0 or p_vat_rate > 100 then raise exception 'VAT rate must be between 0 and 100.'; end if;
  select * into v_review from public.commercial_reviews where organisation_id=p_organisation_id and id=p_review_id for update;
  if not found then raise exception 'Commercial review not found.'; end if;
  if v_review.status not in ('pending_approval','draft') then raise exception 'Commercial review is not awaiting approval.'; end if;
  if v_review.client_price is null or v_review.client_price <= 0 then raise exception 'Client price must be greater than zero.'; end if;

  select * into v_quote from public.quotes where organisation_id=p_organisation_id and commercial_review_id=p_review_id;
  if found then return v_quote; end if;

  update public.commercial_reviews set status='approved',approved_by=p_user_id,approved_at=now() where id=p_review_id;
  v_number := public.op_next_reference(p_organisation_id,'quote',1);
  v_vat := round((v_review.client_price*p_vat_rate/100.0)::numeric,2);
  insert into public.quotes (
    organisation_id,created_by,lead_id,commercial_review_id,quote_number,revision,status,
    subtotal,vat,total,currency
  ) values (
    p_organisation_id,p_user_id,v_review.lead_id,v_review.id,v_number,1,'draft',
    v_review.client_price,v_vat,v_review.client_price+v_vat,upper(p_currency)
  ) returning * into v_quote;

  insert into public.documents (
    organisation_id,lead_id,quote_id,created_by,document_type,reference,title,status,version
  ) values (
    p_organisation_id,v_review.lead_id,v_quote.id,p_user_id,'client_quote',v_number,
    'Client Quote '||v_number,'draft',1
  ) on conflict (organisation_id,reference) do nothing;

  perform public.op_record_activity(p_organisation_id,p_user_id,'quote',v_quote.id,
    'client_quote_generated',jsonb_build_object('commercialReviewId',p_review_id,'vatRate',p_vat_rate));
  return v_quote;
end;
$$;

create or replace function public.op_issue_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid
) returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
declare v_quote public.quotes;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_quote from public.quotes where organisation_id=p_organisation_id and id=p_quote_id for update;
  if not found then raise exception 'Quote not found.'; end if;
  if v_quote.status not in ('draft','internal_review') then raise exception 'Only a draft or internally reviewed quote can be issued.'; end if;
  update public.quotes set status='issued',issued_at=now() where id=p_quote_id returning * into v_quote;
  update public.leads set status='quoted' where organisation_id=p_organisation_id and id=v_quote.lead_id;
  update public.documents set status='issued',issued_at=now() where organisation_id=p_organisation_id and quote_id=p_quote_id and document_type='client_quote';
  perform public.op_record_activity(p_organisation_id,p_user_id,'quote',p_quote_id,'client_quote_issued','{}'::jsonb);
  return v_quote;
end;
$$;

create or replace function public.op_accept_quote_create_project(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid
) returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare v_quote public.quotes; v_lead public.leads; v_project public.projects; v_number text; v_sow text; v_cls text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_quote from public.quotes where organisation_id=p_organisation_id and id=p_quote_id for update;
  if not found then raise exception 'Quote not found.'; end if;
  if v_quote.status <> 'issued' then raise exception 'Only an issued quote can be accepted.'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then raise exception 'Quote has expired.'; end if;

  select * into v_project from public.projects where organisation_id=p_organisation_id and quote_id=p_quote_id;
  if found then return v_project; end if;
  select * into v_lead from public.leads where organisation_id=p_organisation_id and id=v_quote.lead_id;
  if not found then raise exception 'Lead not found.'; end if;

  update public.quotes set status='accepted',accepted_at=now() where id=p_quote_id;
  update public.leads set status='won' where organisation_id=p_organisation_id and id=v_quote.lead_id;
  v_number := public.op_next_reference(p_organisation_id,'project',null);
  insert into public.projects (
    organisation_id,created_by,project_manager_id,lead_id,quote_id,project_number,title,status,start_date,notes
  ) values (
    p_organisation_id,p_user_id,p_user_id,v_quote.lead_id,v_quote.id,v_number,
    coalesce(nullif(v_lead.title,''),v_lead.company_name||' engineering project'),'planning',current_date,v_lead.notes
  ) returning * into v_project;

  v_sow := public.op_next_reference(p_organisation_id,'document',null);
  v_cls := public.op_next_reference(p_organisation_id,'document',null);
  insert into public.documents (
    organisation_id,lead_id,project_id,quote_id,created_by,document_type,reference,title,status,version
  ) values
    (p_organisation_id,v_quote.lead_id,v_project.id,v_quote.id,p_user_id,'scope_of_work',v_sow,v_project.title||' — Scope of Work','draft',1),
    (p_organisation_id,v_quote.lead_id,v_project.id,v_quote.id,p_user_id,'project_closeout',v_cls,v_project.title||' — Closeout Pack','draft',1);

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',v_project.id,
    'project_created_from_accepted_quote',jsonb_build_object('quoteId',p_quote_id,'inherited',true));
  return v_project;
end;
$$;

create or replace function public.op_convert_prospect(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid
) returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect public.prospects;
  v_company public.companies;
  v_contact public.contacts;
  v_lead public.leads;
  v_lead_ref text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_prospect from public.prospects where organisation_id=p_organisation_id and id=p_prospect_id for update;
  if not found then raise exception 'Prospect not found.'; end if;
  if v_prospect.converted_lead_id is not null then
    select * into v_lead from public.leads where id=v_prospect.converted_lead_id;
    return v_lead;
  end if;
  if nullif(trim(v_prospect.company_name),'') is null then raise exception 'Company name is required.'; end if;
  if nullif(trim(coalesce(v_prospect.requirement_summary,'')),'') is null then raise exception 'Structured requirement summary is required.'; end if;

  select * into v_company from public.companies
  where organisation_id=p_organisation_id and lower(name)=lower(v_prospect.company_name) limit 1;
  if not found then
    insert into public.companies (organisation_id,name,industry,created_by)
    values (p_organisation_id,v_prospect.company_name,v_prospect.industry,p_user_id)
    returning * into v_company;
  end if;

  if v_prospect.contact_name is not null then
    select * into v_contact from public.contacts
    where organisation_id=p_organisation_id and company_id=v_company.id
      and ((v_prospect.email is not null and lower(email)=lower(v_prospect.email)) or lower(full_name)=lower(v_prospect.contact_name)) limit 1;
    if not found then
      insert into public.contacts (organisation_id,company_id,full_name,job_title,email,phone,linkedin_url,created_by)
      values (p_organisation_id,v_company.id,v_prospect.contact_name,v_prospect.job_title,v_prospect.email,v_prospect.phone,v_prospect.linkedin_url,p_user_id)
      returning * into v_contact;
    end if;
  end if;

  v_lead_ref := public.op_next_reference(p_organisation_id,'lead',null);
  insert into public.leads (
    organisation_id,created_by,owner_id,company_name,contact_name,contact_email,project_type,status,notes,
    company_id,contact_id,prospect_id,source,title,service,priority
  ) values (
    p_organisation_id,p_user_id,p_user_id,v_prospect.company_name,v_prospect.contact_name,v_prospect.email,
    v_prospect.project_type,'qualified',v_prospect.requirement_summary,v_company.id,v_contact.id,v_prospect.id,
    v_prospect.source,v_lead_ref, v_prospect.project_type,'normal'
  ) returning * into v_lead;

  update public.prospects set status='converted',converted_lead_id=v_lead.id,company_id=v_company.id,
    contact_id=v_contact.id,assigned_to=p_user_id where id=v_prospect.id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'prospect',v_prospect.id,
    'prospect_converted',jsonb_build_object('leadId',v_lead.id,'companyId',v_company.id,'contactId',v_contact.id));
  return v_lead;
end;
$$;

grant execute on function public.op_approve_technical_intake(uuid,uuid,uuid) to authenticated;
grant execute on function public.op_create_commercial_review(uuid,uuid,uuid,numeric) to authenticated;
grant execute on function public.op_approve_commercial_generate_quote(uuid,uuid,uuid,text,numeric) to authenticated;
grant execute on function public.op_issue_quote(uuid,uuid,uuid) to authenticated;
grant execute on function public.op_accept_quote_create_project(uuid,uuid,uuid) to authenticated;
grant execute on function public.op_convert_prospect(uuid,uuid,uuid) to authenticated;

commit;
