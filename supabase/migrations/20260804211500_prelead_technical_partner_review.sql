begin;

create table if not exists public.prospect_technical_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  intake_session_id uuid not null references public.intake_sessions(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete restrict,
  reviewed_by uuid not null,
  decision text not null check (decision in ('feasible','feasible_with_clarification','not_feasible')),
  status text not null default 'approved' check (status in ('draft','approved','rejected','superseded')),
  confidence_percent integer not null check (confidence_percent between 0 and 100),
  estimated_hours numeric(10,2),
  estimated_lead_time_days integer,
  pricing_ready boolean not null default false,
  missing_information text,
  technical_risks text,
  assumptions text,
  review_notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_prospect_technical_reviews_current
  on public.prospect_technical_reviews (organisation_id, prospect_id)
  where status in ('draft','approved');

alter table public.prospect_technical_reviews enable row level security;

create policy prospect_technical_reviews_org_access
  on public.prospect_technical_reviews for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organisation_id = prospect_technical_reviews.organisation_id
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organisation_id = prospect_technical_reviews.organisation_id
  ));

create or replace function public.op_convert_prospect(
  p_organisation_id uuid,
  p_user_id uuid,
  p_prospect_id uuid
) returns public.leads
language plpgsql security definer set search_path=public
as $$
declare
  v_prospect public.prospects; v_company public.companies; v_contact public.contacts; v_lead public.leads;
  v_session public.intake_sessions; v_submission public.intake_submissions; v_intake public.technical_intakes;
  v_review public.prospect_technical_reviews;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_prospect from public.prospects where organisation_id=p_organisation_id and id=p_prospect_id for update;
  if not found then raise exception 'Prospect not found.'; end if;
  if v_prospect.status <> 'qualified' then raise exception 'Only a commercially qualified prospect can be converted.'; end if;
  if v_prospect.converted_lead_id is not null then select * into v_lead from public.leads where id=v_prospect.converted_lead_id; return v_lead; end if;
  if nullif(trim(v_prospect.company_name),'') is null then raise exception 'Company name is required.'; end if;
  if nullif(trim(coalesce(v_prospect.requirement_summary,'')),'') is null then raise exception 'Structured requirement summary is required.'; end if;
  if nullif(trim(coalesce(v_prospect.project_type,'')),'') is null then raise exception 'Project type is required.'; end if;

  select * into v_review
  from public.prospect_technical_reviews
  where organisation_id=p_organisation_id
    and prospect_id=p_prospect_id
    and status='approved'
    and decision in ('feasible','feasible_with_clarification')
  order by approved_at desc nulls last, created_at desc
  limit 1;
  if not found then raise exception 'An approved feasible technical partner review is required before lead conversion.'; end if;

  select * into v_company from public.companies where organisation_id=p_organisation_id and lower(name)=lower(v_prospect.company_name) limit 1;
  if not found then insert into public.companies (organisation_id,name,industry,created_by) values (p_organisation_id,v_prospect.company_name,v_prospect.industry,p_user_id) returning * into v_company; end if;
  if v_prospect.contact_name is not null then
    select * into v_contact from public.contacts where organisation_id=p_organisation_id and company_id=v_company.id and ((v_prospect.email is not null and lower(email)=lower(v_prospect.email)) or lower(full_name)=lower(v_prospect.contact_name)) limit 1;
    if not found then insert into public.contacts (organisation_id,company_id,full_name,job_title,email,phone,linkedin_url,created_by) values (p_organisation_id,v_company.id,v_prospect.contact_name,v_prospect.job_title,v_prospect.email,v_prospect.phone,v_prospect.linkedin_url,p_user_id) returning * into v_contact; end if;
  end if;
  insert into public.leads (organisation_id,created_by,owner_id,company_name,contact_name,contact_email,project_type,status,notes,company_id,contact_id,prospect_id,source,title,service,priority)
  values (p_organisation_id,p_user_id,p_user_id,v_prospect.company_name,v_prospect.contact_name,v_prospect.email,v_prospect.project_type,'qualified',v_prospect.requirement_summary,v_company.id,case when v_contact.id is null then null else v_contact.id end,v_prospect.id,v_prospect.source,v_prospect.company_name||' — '||v_prospect.project_type,'Engineering overflow support','normal') returning * into v_lead;

  select * into v_session from public.intake_sessions where organisation_id=p_organisation_id and prospect_id=p_prospect_id and status='submitted' order by submitted_at desc limit 1;
  if found then
    select * into v_submission from public.intake_submissions where intake_session_id=v_session.id;
    if found then
      insert into public.technical_intakes (organisation_id,created_by,lead_id,description,deliverables,project_type,discipline,deadline,status,submitted_at)
      values (p_organisation_id,p_user_id,v_lead.id,v_submission.description,v_submission.deliverables,v_submission.project_type,v_submission.discipline,v_submission.deadline,'submitted',v_submission.submitted_at)
      returning * into v_intake;
      update public.intake_sessions set lead_id=v_lead.id,status='converted',updated_at=now() where id=v_session.id;
      update public.intake_files set lead_id=v_lead.id where intake_session_id=v_session.id;
      perform public.op_record_activity(p_organisation_id,p_user_id,'technical_intake',v_intake.id,'technical_intake_inherited_from_step_2',jsonb_build_object('prospectId',p_prospect_id,'sessionId',v_session.id));
    end if;
  end if;

  update public.prospects set status='converted',converted_lead_id=v_lead.id,company_id=v_company.id,contact_id=case when v_contact.id is null then null else v_contact.id end,assigned_to=p_user_id where id=v_prospect.id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'prospect',v_prospect.id,'prospect_converted',jsonb_build_object('leadId',v_lead.id,'leadReference',v_lead.reference,'companyId',v_company.id,'contactId',v_contact.id,'technicalReviewId',v_review.id,'partnerId',v_review.partner_id));
  perform public.op_record_activity(p_organisation_id,p_user_id,'lead',v_lead.id,'lead_created_from_prospect',jsonb_build_object('prospectId',v_prospect.id,'reference',v_lead.reference,'technicalReviewId',v_review.id));
  return v_lead;
end; $$;

commit;
