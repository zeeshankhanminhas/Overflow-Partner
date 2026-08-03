begin;

alter table public.leads add column if not exists reference text;
create unique index if not exists ux_leads_org_reference on public.leads (organisation_id, reference) where reference is not null;

create or replace function public.op_assign_lead_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference is null or trim(new.reference) = '' then
    new.reference := public.op_next_reference(new.organisation_id, 'lead', null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_op_assign_lead_reference on public.leads;
create trigger trg_op_assign_lead_reference
before insert on public.leads
for each row execute function public.op_assign_lead_reference();

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
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  select * into v_prospect from public.prospects where organisation_id=p_organisation_id and id=p_prospect_id for update;
  if not found then raise exception 'Prospect not found.'; end if;
  if v_prospect.status <> 'qualified' then raise exception 'Only a qualified prospect can be converted.'; end if;
  if v_prospect.converted_lead_id is not null then
    select * into v_lead from public.leads where id=v_prospect.converted_lead_id;
    return v_lead;
  end if;
  if nullif(trim(v_prospect.company_name),'') is null then raise exception 'Company name is required.'; end if;
  if nullif(trim(coalesce(v_prospect.requirement_summary,'')),'') is null then raise exception 'Structured requirement summary is required.'; end if;
  if nullif(trim(coalesce(v_prospect.project_type,'')),'') is null then raise exception 'Project type is required.'; end if;

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

  insert into public.leads (
    organisation_id,created_by,owner_id,company_name,contact_name,contact_email,project_type,status,notes,
    company_id,contact_id,prospect_id,source,title,service,priority
  ) values (
    p_organisation_id,p_user_id,p_user_id,v_prospect.company_name,v_prospect.contact_name,v_prospect.email,
    v_prospect.project_type,'qualified',v_prospect.requirement_summary,v_company.id,
    case when v_contact.id is null then null else v_contact.id end,
    v_prospect.id,v_prospect.source,v_prospect.company_name||' — '||v_prospect.project_type,
    'Engineering overflow support','normal'
  ) returning * into v_lead;

  update public.prospects set status='converted',converted_lead_id=v_lead.id,company_id=v_company.id,
    contact_id=case when v_contact.id is null then null else v_contact.id end,assigned_to=p_user_id where id=v_prospect.id;
  perform public.op_record_activity(p_organisation_id,p_user_id,'prospect',v_prospect.id,
    'prospect_converted',jsonb_build_object('leadId',v_lead.id,'leadReference',v_lead.reference,'companyId',v_company.id,'contactId',v_contact.id));
  perform public.op_record_activity(p_organisation_id,p_user_id,'lead',v_lead.id,
    'lead_created_from_prospect',jsonb_build_object('prospectId',v_prospect.id,'reference',v_lead.reference));
  return v_lead;
end;
$$;

commit;
