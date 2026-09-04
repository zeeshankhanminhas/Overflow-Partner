-- Structured evidence required by controlled commercial and delivery documents.

create table if not exists public.client_commercial_profiles (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade, company_id uuid references public.companies(id) on delete cascade,
  legal_name text not null, legal_address text not null, billing_address text not null, accounts_payable_email text not null,
  company_number text, vat_number text, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint client_commercial_profile_owner check (lead_id is not null or company_id is not null)
);
create unique index if not exists client_commercial_profiles_lead_idx on public.client_commercial_profiles(organisation_id,lead_id) where lead_id is not null;
create unique index if not exists client_commercial_profiles_company_idx on public.client_commercial_profiles(organisation_id,company_id) where company_id is not null;

create table if not exists public.requirement_items (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  technical_intake_id uuid not null references public.technical_intakes(id) on delete cascade, item_code text not null, category text not null default 'technical',
  requirement text not null, priority text not null default 'required' check (priority in ('required','preferred','optional')),
  verification_method text, acceptance_criteria text, status text not null default 'open' check (status in ('open','confirmed','superseded','withdrawn')),
  confirmed_by uuid references public.profiles(id), confirmed_at timestamptz, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(technical_intake_id,item_code)
);

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade, sequence_no integer not null default 1, description text not null,
  quantity numeric(14,3) not null default 1 check(quantity > 0), unit text not null default 'item', unit_price numeric(14,2) not null check(unit_price >= 0),
  vat_rate numeric(6,2) not null default 20 check(vat_rate >= 0), net_total numeric(14,2) generated always as (round(quantity * unit_price,2)) stored,
  created_at timestamptz not null default now(), unique(quote_id,sequence_no)
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade, sequence_no integer not null default 1, description text not null,
  quantity numeric(14,3) not null default 1 check(quantity > 0), unit text not null default 'item', unit_price numeric(14,2) not null check(unit_price >= 0),
  vat_rate numeric(6,2) not null default 20 check(vat_rate >= 0), net_total numeric(14,2) generated always as (round(quantity * unit_price,2)) stored,
  created_at timestamptz not null default now(), unique(invoice_id,sequence_no)
);

create table if not exists public.project_change_requests (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, change_reference text not null, description text not null, reason text not null,
  scope_impact text, programme_impact text, commercial_impact numeric(14,2), currency text not null default 'GBP',
  status text not null default 'proposed' check(status in ('proposed','under_review','approved','rejected','implemented','withdrawn')),
  requested_by uuid references public.profiles(id), approved_by uuid references public.profiles(id), approved_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organisation_id,change_reference)
);

alter table public.project_delivery_items add column if not exists acceptance_criteria text;
alter table public.project_delivery_items add column if not exists output_format text;
alter table public.project_delivery_items add column if not exists acceptance_evidence text;

create table if not exists public.approved_clause_versions (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references public.organisations(id) on delete cascade,
  clause_key text not null, title text not null, body text not null, version integer not null default 1,
  status text not null default 'draft' check(status in ('draft','approved','retired')), approved_by uuid references public.profiles(id), approved_at timestamptz,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(organisation_id,clause_key,version)
);

do $$ declare t text; begin
  foreach t in array array['client_commercial_profiles','requirement_items','quote_line_items','invoice_line_items','project_change_requests','approved_clause_versions'] loop
    execute format('alter table public.%I enable row level security',t);
    if not exists(select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_member_read') then
      execute format('create policy %I on public.%I for select to authenticated using (organisation_id=public.current_organisation_id())',t||'_member_read',t);
      execute format('create policy %I on public.%I for insert to authenticated with check (organisation_id=public.current_organisation_id())',t||'_member_insert',t);
      execute format('create policy %I on public.%I for update to authenticated using (organisation_id=public.current_organisation_id()) with check (organisation_id=public.current_organisation_id())',t||'_member_update',t);
      execute format('create policy %I on public.%I for delete to authenticated using (organisation_id=public.current_organisation_id())',t||'_member_delete',t);
    end if;
  end loop;
end $$;

create index if not exists requirement_items_intake_idx on public.requirement_items(technical_intake_id,status);
create index if not exists quote_line_items_quote_idx on public.quote_line_items(quote_id,sequence_no);
create index if not exists invoice_line_items_invoice_idx on public.invoice_line_items(invoice_id,sequence_no);
create index if not exists project_change_requests_project_idx on public.project_change_requests(project_id,status);
