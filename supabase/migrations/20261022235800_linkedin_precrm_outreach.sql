-- Pre-CRM LinkedIn outreach. Cold contacts never enter Companies, Contacts or Prospects.
-- Separate from the governed acquisition lifecycle. No existing rows are altered.
create table public.linkedin_outreach_threads (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  created_by uuid not null references public.profiles(id),
  company_name text not null check (length(trim(company_name)) between 2 and 180),
  contact_name text not null check (length(trim(contact_name)) between 2 and 180),
  job_title text,
  linkedin_url text,
  state text not null default 'new' check (state in ('new','waiting','followup','interested','closed','converted')),
  next_follow_up_at timestamptz,
  crm_prospect_id uuid references public.prospects(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outreach_converted_has_crm check ((state='converted') = (crm_prospect_id is not null))
);
create unique index linkedin_outreach_unique_profile on public.linkedin_outreach_threads
  (organisation_id, lower(linkedin_url)) where linkedin_url is not null and length(linkedin_url)>0;
create index linkedin_outreach_worklist on public.linkedin_outreach_threads
  (organisation_id, state, next_follow_up_at, created_at desc);

create table public.linkedin_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  outreach_id uuid not null references public.linkedin_outreach_threads(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  source text not null check (source in ('linkedin','sales_navigator','note')),
  body text not null check (length(trim(body)) between 1 and 60000),
  created_at timestamptz not null default now()
);
create index linkedin_outreach_messages_timeline on public.linkedin_outreach_messages
  (organisation_id,outreach_id,created_at,id);

alter table public.linkedin_outreach_threads enable row level security;
alter table public.linkedin_outreach_messages enable row level security;
revoke all on public.linkedin_outreach_threads, public.linkedin_outreach_messages from public, anon, authenticated;
grant select, insert on public.linkedin_outreach_threads, public.linkedin_outreach_messages to authenticated;
grant update (state,next_follow_up_at,crm_prospect_id,updated_at) on public.linkedin_outreach_threads to authenticated;

create policy "outreach threads for authorised staff" on public.linkedin_outreach_threads
 for select to authenticated using (exists (
  select 1 from public.profiles p where p.id=(select auth.uid())
  and p.organisation_id=linkedin_outreach_threads.organisation_id and p.is_active
  and p.role::text in ('owner','admin','business_development','operator')
 ));
create policy "outreach thread creation" on public.linkedin_outreach_threads
 for insert to authenticated with check (
  created_by=(select auth.uid()) and state='new' and crm_prospect_id is null
  and exists (select 1 from public.profiles p where p.id=(select auth.uid())
   and p.organisation_id=linkedin_outreach_threads.organisation_id and p.is_active
   and p.role::text in ('owner','admin','business_development','operator'))
 );
create policy "outreach thread followups and promotion" on public.linkedin_outreach_threads
 for update to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid())
   and p.organisation_id=linkedin_outreach_threads.organisation_id and p.is_active
   and p.role::text in ('owner','admin','business_development','operator'))
 ) with check (
  exists (select 1 from public.profiles p where p.id=(select auth.uid())
   and p.organisation_id=linkedin_outreach_threads.organisation_id and p.is_active
   and p.role::text in ('owner','admin','business_development','operator'))
  and (crm_prospect_id is null or (
   state='converted' and exists (
    select 1 from public.prospects x
    where x.id=linkedin_outreach_threads.crm_prospect_id
    and x.organisation_id=linkedin_outreach_threads.organisation_id
    and x.source='linkedin' and x.response_outcome='interested'
   )))
 );
create policy "outreach messages read" on public.linkedin_outreach_messages
 for select to authenticated using (
  exists (select 1 from public.linkedin_outreach_threads t
   where t.id=linkedin_outreach_messages.outreach_id
   and t.organisation_id=linkedin_outreach_messages.organisation_id)
 );
create policy "outreach messages append" on public.linkedin_outreach_messages
 for insert to authenticated with check (
  created_by=(select auth.uid())
  and exists (select 1 from public.linkedin_outreach_threads t
   where t.id=linkedin_outreach_messages.outreach_id
   and t.organisation_id=linkedin_outreach_messages.organisation_id
   and t.state <> 'converted')
 );
-- No updates/deletes of conversation history; edits require new, dated entries.

-- Promotion is a single PostgreSQL transaction. Only a confirmed-interested
-- outreach thread enters CRM; repeated requests return the same Prospect.
-- Invoker privileges + table RLS remain in force (no privileged bypass).
create or replace function public.op_promote_linkedin_outreach(p_outreach_id uuid)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v public.linkedin_outreach_threads%rowtype;
  company_id uuid;
  contact_id uuid;
  prospect_id uuid;
  other_company uuid;
  contact_preference text;
begin
  select * into v from public.linkedin_outreach_threads
  where id=p_outreach_id for update;
  if not found then raise exception 'Outreach conversation not found or access denied'; end if;
  if v.crm_prospect_id is not null then return v.crm_prospect_id; end if;
  if v.state <> 'interested' then raise exception 'Confirm an interested reply before creating CRM records'; end if;
  if not exists (select 1 from public.profiles p where p.id=auth.uid()
    and p.organisation_id=v.organisation_id and p.is_active
    and p.role::text in ('owner','admin','business_development','operator'))
  then raise exception 'Not authorised to promote this conversation'; end if;

  select id into company_id from public.companies c
    where c.organisation_id=v.organisation_id and lower(c.name)=lower(v.company_name)
    order by c.created_at asc limit 1;
  if company_id is null then
    insert into public.companies (organisation_id,created_by,name,country,lifecycle_status)
    values (v.organisation_id,auth.uid(),v.company_name,'United Kingdom','active')
    returning id into company_id;
  end if;
  if v.linkedin_url is not null then
    select c.id,c.company_id,c.communication_status
      into contact_id,other_company,contact_preference
      from public.contacts c where c.organisation_id=v.organisation_id
      and c.linkedin_url=v.linkedin_url order by c.created_at limit 1;
    if contact_id is not null and other_company is distinct from company_id then
      raise exception 'This LinkedIn contact belongs to another company. Resolve the CRM match manually.';
    end if;
  end if;
  if contact_id is null then
    select c.id,c.communication_status into contact_id,contact_preference from public.contacts c
      where c.organisation_id=v.organisation_id and c.company_id=company_id
      and lower(c.full_name)=lower(v.contact_name) order by c.created_at limit 1;
  end if;
  if contact_preference='do_not_contact' then
    raise exception 'The existing contact is marked Do not contact';
  end if;
  if contact_id is null then
    insert into public.contacts (organisation_id,created_by,company_id,full_name,job_title,linkedin_url,lifecycle_status,communication_status)
    values (v.organisation_id,auth.uid(),company_id,v.contact_name,v.job_title,v.linkedin_url,'active','marketable')
    returning id into contact_id;
  end if;
  select p.id into prospect_id from public.prospects p
    where p.organisation_id=v.organisation_id and p.contact_id=contact_id
    and p.status not in ('converted','not_a_fit') order by p.created_at desc limit 1;
  if prospect_id is null then
    insert into public.prospects (
      organisation_id,created_by,assigned_to,company_id,contact_id,company_name,contact_name,
      job_title,linkedin_url,source,status,outreach_status,response_outcome,next_action
    ) values (
      v.organisation_id,auth.uid(),auth.uid(),company_id,contact_id,v.company_name,v.contact_name,
      v.job_title,v.linkedin_url,'linkedin','conversation','replied','interested',
      'Prepare secure requirements invitation'
    ) returning id into prospect_id;
  else
    -- Existing CRM record cannot be silently re-qualified or overwritten.
    if not exists (select 1 from public.prospects p where p.id=prospect_id
      and p.source='linkedin' and p.response_outcome='interested') then
      raise exception 'An existing unqualified Prospect needs review before linking.';
    end if;
  end if;
  update public.linkedin_outreach_threads
    set state='converted',crm_prospect_id=prospect_id,next_follow_up_at=null,updated_at=now()
    where id=p_outreach_id;
  return prospect_id;
end;
$$;
revoke all on function public.op_promote_linkedin_outreach(uuid) from public,anon;
grant execute on function public.op_promote_linkedin_outreach(uuid) to authenticated;
