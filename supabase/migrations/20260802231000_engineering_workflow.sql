-- Overflow Partner OS: engineering and commercial workflow

create type public.intake_status as enum ('draft','submitted','under_review','clarification_required','approved','rejected');
create type public.partner_status as enum ('prospective','approved','suspended','inactive');
create type public.partner_quote_status as enum ('requested','received','under_review','selected','declined','expired');
create type public.commercial_review_status as enum ('draft','pending_approval','approved','rejected');
create type public.quote_status as enum ('draft','internal_review','issued','accepted','declined','expired','superseded');
create type public.project_status as enum ('planning','active','waiting','review','completed','closed','cancelled');

create table public.technical_intakes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  project_type text,
  discipline text,
  description text not null,
  deliverables text,
  deadline date,
  special_requirements text,
  status public.intake_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  technical_intake_id uuid references public.technical_intakes(id) on delete cascade,
  storage_bucket text not null default 'project-files',
  storage_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint file_has_parent check (lead_id is not null or technical_intake_id is not null)
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  company_name text not null,
  country text,
  services text,
  contact_name text,
  email text,
  phone text,
  nda_signed boolean not null default false,
  nda_signed_at timestamptz,
  status public.partner_status not null default 'prospective',
  rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5)),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_quotes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  technical_intake_id uuid references public.technical_intakes(id) on delete set null,
  price numeric(14,2) not null check (price >= 0),
  currency char(3) not null default 'GBP',
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  valid_until date,
  notes text,
  status public.partner_quote_status not null default 'requested',
  submitted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.commercial_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  partner_quote_id uuid references public.partner_quotes(id) on delete set null,
  client_price numeric(14,2) not null check (client_price >= 0),
  cost_price numeric(14,2) check (cost_price is null or cost_price >= 0),
  margin_amount numeric(14,2),
  margin_percent numeric(7,3),
  status public.commercial_review_status not null default 'draft',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  commercial_review_id uuid references public.commercial_reviews(id) on delete set null,
  quote_number text not null,
  revision integer not null default 1 check (revision > 0),
  status public.quote_status not null default 'draft',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  vat numeric(14,2) not null default 0 check (vat >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  currency char(3) not null default 'GBP',
  valid_until date,
  issued_at timestamptz,
  accepted_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, quote_number, revision)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,
  project_number text not null,
  title text not null,
  status public.project_status not null default 'planning',
  start_date date,
  due_date date,
  project_manager_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, project_number)
);

create index technical_intakes_lead_id_idx on public.technical_intakes(lead_id);
create index files_lead_id_idx on public.files(lead_id);
create index files_intake_id_idx on public.files(technical_intake_id);
create index partners_organisation_id_idx on public.partners(organisation_id);
create index partner_quotes_lead_id_idx on public.partner_quotes(lead_id);
create index partner_quotes_partner_id_idx on public.partner_quotes(partner_id);
create index commercial_reviews_lead_id_idx on public.commercial_reviews(lead_id);
create index quotes_lead_id_idx on public.quotes(lead_id);
create index projects_lead_id_idx on public.projects(lead_id);
create index projects_status_idx on public.projects(status);
