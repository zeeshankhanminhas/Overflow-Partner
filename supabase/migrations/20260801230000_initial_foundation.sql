create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'operator', 'reviewer');
create type public.lead_status as enum ('new', 'qualified', 'technical_intake', 'partner_review', 'pricing', 'quoted', 'won', 'lost');
create type public.document_status as enum ('draft', 'in_review', 'approved', 'issued', 'superseded');

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  full_name text,
  role public.app_role not null default 'operator',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  company_name text not null,
  contact_name text,
  contact_email text,
  project_type text,
  status public.lead_status not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  document_type text not null,
  reference text not null unique,
  title text not null,
  status public.document_status not null default 'draft',
  storage_path text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_organisation_id_idx on public.leads(organisation_id);
create index documents_organisation_id_idx on public.documents(organisation_id);
create index documents_lead_id_idx on public.documents(lead_id);

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.documents enable row level security;

create policy "profiles can read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "users can read their organisation"
on public.organisations for select to authenticated
using (id = (select organisation_id from public.profiles where id = (select auth.uid())));

create policy "organisation members can read leads"
on public.leads for select to authenticated
using (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())));

create policy "organisation members can create leads"
on public.leads for insert to authenticated
with check (
  created_by = (select auth.uid())
  and organisation_id = (select organisation_id from public.profiles where id = (select auth.uid()))
);

create policy "organisation members can update leads"
on public.leads for update to authenticated
using (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())))
with check (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())));

create policy "organisation members can read documents"
on public.documents for select to authenticated
using (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())));

create policy "organisation members can create documents"
on public.documents for insert to authenticated
with check (
  created_by = (select auth.uid())
  and organisation_id = (select organisation_id from public.profiles where id = (select auth.uid()))
);

create policy "organisation members can update documents"
on public.documents for update to authenticated
using (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())))
with check (organisation_id = (select organisation_id from public.profiles where id = (select auth.uid())));
