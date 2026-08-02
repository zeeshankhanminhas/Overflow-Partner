-- Overflow Partner OS: core CRM extension
-- Extends the existing organisations, profiles, prospects and leads tables.

alter type public.app_role add value if not exists 'owner';
alter type public.app_role add value if not exists 'business_development';
alter type public.app_role add value if not exists 'engineering';
alter type public.app_role add value if not exists 'commercial';
alter type public.app_role add value if not exists 'partner';
alter type public.app_role add value if not exists 'viewer';

alter table public.organisations
  add column if not exists company_number text,
  add column if not exists vat_number text,
  add column if not exists website text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists country text default 'United Kingdom',
  add column if not exists timezone text not null default 'Europe/London',
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists job_title text,
  add column if not exists avatar_url text,
  add column if not exists is_active boolean not null default true;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  country text,
  employee_count integer check (employee_count is null or employee_count >= 0),
  annual_revenue numeric(14,2) check (annual_revenue is null or annual_revenue >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, name)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  full_name text not null,
  job_title text,
  email text,
  phone text,
  linkedin_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prospects
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists phone text,
  add column if not exists industry text,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

alter table public.leads
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists prospect_id uuid references public.prospects(id) on delete set null,
  add column if not exists source public.acquisition_source,
  add column if not exists title text,
  add column if not exists service text,
  add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

create index if not exists companies_organisation_id_idx on public.companies(organisation_id);
create index if not exists contacts_organisation_id_idx on public.contacts(organisation_id);
create index if not exists contacts_company_id_idx on public.contacts(company_id);
create index if not exists prospects_company_id_idx on public.prospects(company_id);
create index if not exists prospects_contact_id_idx on public.prospects(contact_id);
create index if not exists leads_company_id_idx on public.leads(company_id);
create index if not exists leads_contact_id_idx on public.leads(contact_id);
create index if not exists leads_prospect_id_idx on public.leads(prospect_id);
create index if not exists leads_owner_id_idx on public.leads(owner_id);
