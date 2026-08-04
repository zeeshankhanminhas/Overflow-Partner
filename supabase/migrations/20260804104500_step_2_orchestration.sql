begin;

create extension if not exists pgcrypto;

create table if not exists public.intake_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  token_hash text not null unique,
  status text not null default 'invited' check (status in ('invited','opened','in_progress','submitted','converted','expired','cancelled')),
  expires_at timestamptz not null,
  sent_at timestamptz,
  opened_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_intake_sessions_active_prospect
  on public.intake_sessions (organisation_id, prospect_id)
  where status not in ('converted','expired','cancelled');

create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  intake_session_id uuid not null unique references public.intake_sessions(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  description text not null,
  deliverables text not null,
  project_type text not null,
  discipline text,
  software text,
  drawing_count integer,
  source_file_format text,
  required_output_format text,
  deadline date,
  standards text,
  tolerances text,
  revision_status text,
  special_instructions text,
  completion_percent integer not null default 100 check (completion_percent between 0 and 100),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intake_files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  intake_session_id uuid not null references public.intake_sessions(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  file_category text not null default 'reference',
  uploaded_at timestamptz not null default now()
);

alter table public.intake_sessions enable row level security;
alter table public.intake_submissions enable row level security;
alter table public.intake_files enable row level security;

create policy intake_sessions_org_access on public.intake_sessions for all using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=intake_sessions.organisation_id)
) with check (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=intake_sessions.organisation_id)
);
create policy intake_submissions_org_access on public.intake_submissions for all using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=intake_submissions.organisation_id)
) with check (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=intake_submissions.organisation_id)
);
create policy intake_files_org_access on public.intake_files for all using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=intake_files.organisation_id)
) with check (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=intake_files.organisation_id)
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('technical-intake','technical-intake',false,26214400,array['application/pdf','image/png','image/jpeg','application/zip','application/x-zip-compressed','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/dxf','application/octet-stream'])
on conflict (id) do nothing;

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
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_prospect from public.prospects where organisation_id=p_organisation_id and id=p_prospect_id for update;
  if not found then raise exception 'Prospect not found.'; end if;
  if v_prospect.status <> 'qualified' then raise exception 'Only a qualified prospect can be converted.'; end if;
  if v_prospect.converted_lead_id is not null then select * into v_lead from public.leads where id=v_prospect.converted_lead_id; return v_lead; end if;
  if nullif(trim(v_prospect.company_name),'') is null then raise exception 'Company name is required.'; end if;
  if nullif(trim(coalesce(v_prospect.requirement_summary,'')),'') is null then raise exception 'Structured requirement summary is required.'; end if;
  if nullif(trim(coalesce(v_prospect.project_type,'')),'') is null then raise exception 'Project type is required.'; end if;

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
  perform public.op_record_activity(p_organisation_id,p_user_id,'prospect',v_prospect.id,'prospect_converted',jsonb_build_object('leadId',v_lead.id,'leadReference',v_lead.reference,'companyId',v_company.id,'contactId',v_contact.id));
  perform public.op_record_activity(p_organisation_id,p_user_id,'lead',v_lead.id,'lead_created_from_prospect',jsonb_build_object('prospectId',v_prospect.id,'reference',v_lead.reference));
  return v_lead;
end; $$;

commit;
