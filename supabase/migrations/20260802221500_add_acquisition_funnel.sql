create type public.acquisition_source as enum ('linkedin', 'website', 'email', 'referral', 'phone', 'manual');
create type public.prospect_status as enum ('identified', 'contacted', 'conversation', 'qualified', 'converted', 'not_a_fit');

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  source public.acquisition_source not null default 'linkedin',
  company_name text not null,
  contact_name text,
  job_title text,
  linkedin_url text,
  email text,
  status public.prospect_status not null default 'identified',
  last_contacted_at timestamptz,
  next_action text,
  next_action_at timestamptz,
  notes text,
  converted_lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint converted_prospect_requires_lead check (status <> 'converted' or converted_lead_id is not null)
);

create index prospects_organisation_id_idx on public.prospects(organisation_id);
create index prospects_source_status_idx on public.prospects(source, status);
create index prospects_next_action_at_idx on public.prospects(next_action_at);

alter table public.prospects enable row level security;

create policy "organisation members can read prospects"
on public.prospects for select to authenticated
using (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())));

create policy "organisation members can create prospects"
on public.prospects for insert to authenticated
with check (
  created_by = (select auth.uid())
  and organisation_id = (select organisation_id from public.profiles where id = (select auth.uid()))
);

create policy "organisation members can update prospects"
on public.prospects for update to authenticated
using (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())))
with check (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())));
