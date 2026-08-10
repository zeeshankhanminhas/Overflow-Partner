begin;

-- Partner execution is deliberately additive in shadow mode.
-- It records external execution evidence without changing projects.project_stage
-- or any existing project readiness/transition function.

create table if not exists public.project_execution_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  scope_document_id uuid references public.documents(id),
  partner_contact_name text,
  partner_contact_email text not null,
  execution_state text not null default 'not_released' check (execution_state in (
    'not_released','awaiting_acknowledgement','executing','blocked','delivery_submitted','closed','cancelled'
  )),
  release_reference text,
  planned_start_date date,
  committed_due_date date,
  reporting_cadence text not null default 'milestone' check (reporting_cadence in (
    'milestone','daily','every_2_business_days','weekly','on_change'
  )),
  release_notes text,
  released_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists project_execution_assignments_org_idx
  on public.project_execution_assignments (organisation_id, project_id);
create index if not exists project_execution_assignments_partner_idx
  on public.project_execution_assignments (organisation_id, partner_id);

create table if not exists public.partner_execution_sessions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  recipient_email text not null,
  token_hash text not null unique,
  status text not null default 'invited' check (status in (
    'invited','opened','active','completed','expired','revoked'
  )),
  expires_at timestamptz not null,
  first_opened_at timestamptz,
  last_opened_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_execution_sessions_assignment_idx
  on public.partner_execution_sessions (assignment_id, status);

create table if not exists public.partner_commencement_declarations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  execution_lead_name text not null,
  execution_lead_role text,
  planned_commencement_date date not null,
  forecast_delivery_date date not null,
  scope_reviewed boolean not null,
  inputs_received boolean not null,
  capacity_confirmed boolean not null,
  no_unresolved_blocker boolean not null,
  assumptions text,
  declaration_text text not null,
  submitted_by_name text not null,
  submitted_by_role text,
  submitted_at timestamptz not null default now(),
  unique (assignment_id)
);

create table if not exists public.partner_progress_updates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  progress_state text not null check (progress_state in ('on_track','at_risk','blocked')),
  percent_complete numeric(5,2) check (percent_complete is null or (percent_complete >= 0 and percent_complete <= 100)),
  work_completed text not null,
  work_in_progress text not null,
  forecast_delivery_date date,
  next_update_date date,
  notes text,
  submitted_by_name text not null,
  submitted_by_role text,
  submitted_at timestamptz not null default now()
);

create index if not exists partner_progress_updates_assignment_idx
  on public.partner_progress_updates (assignment_id, submitted_at desc);

create table if not exists public.partner_execution_exceptions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  severity text not null check (severity in ('low','medium','high','critical')),
  title text not null,
  description text not null,
  delivery_impact text,
  required_from text not null default 'overflow_partner' check (required_from in ('overflow_partner','client','partner','unknown')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','withdrawn')),
  submitted_by_name text not null,
  submitted_by_role text,
  raised_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  updated_at timestamptz not null default now()
);

create index if not exists partner_execution_exceptions_assignment_idx
  on public.partner_execution_exceptions (assignment_id, status, raised_at desc);

create table if not exists public.partner_delivery_submissions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  revision text,
  delivery_summary text not null,
  deliverables_manifest text not null,
  declaration_text text not null,
  submitted_by_name text not null,
  submitted_by_role text,
  submitted_at timestamptz not null default now(),
  review_status text not null default 'submitted' check (review_status in ('submitted','under_review','accepted','changes_requested'))
);

create index if not exists partner_delivery_submissions_assignment_idx
  on public.partner_delivery_submissions (assignment_id, submitted_at desc);

-- Keep updated timestamps reliable on mutable execution-control records.
drop trigger if exists project_execution_assignments_set_updated_at on public.project_execution_assignments;
create trigger project_execution_assignments_set_updated_at
before update on public.project_execution_assignments
for each row execute function public.set_updated_at();

drop trigger if exists partner_execution_sessions_set_updated_at on public.partner_execution_sessions;
create trigger partner_execution_sessions_set_updated_at
before update on public.partner_execution_sessions
for each row execute function public.set_updated_at();

drop trigger if exists partner_execution_exceptions_set_updated_at on public.partner_execution_exceptions;
create trigger partner_execution_exceptions_set_updated_at
before update on public.partner_execution_exceptions
for each row execute function public.set_updated_at();

-- Internal users see only their organisation. External token routes use the
-- server-side service role and therefore never receive anonymous table access.
alter table public.project_execution_assignments enable row level security;
alter table public.partner_execution_sessions enable row level security;
alter table public.partner_commencement_declarations enable row level security;
alter table public.partner_progress_updates enable row level security;
alter table public.partner_execution_exceptions enable row level security;
alter table public.partner_delivery_submissions enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'project_execution_assignments',
    'partner_execution_sessions',
    'partner_commencement_declarations',
    'partner_progress_updates',
    'partner_execution_exceptions',
    'partner_delivery_submissions'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_org_access', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (organisation_id = public.current_organisation_id()) with check (organisation_id = public.current_organisation_id())',
      t || '_org_access', t
    );
  end loop;
end $$;

grant select, insert, update, delete on public.project_execution_assignments to authenticated;
grant select, insert, update, delete on public.partner_execution_sessions to authenticated;
grant select, insert on public.partner_commencement_declarations to authenticated;
grant select, insert on public.partner_progress_updates to authenticated;
grant select, insert, update on public.partner_execution_exceptions to authenticated;
grant select, insert, update on public.partner_delivery_submissions to authenticated;

comment on table public.project_execution_assignments is 'Shadow-mode external execution assignment attached to Project 360. Does not control project_stage.';
comment on table public.partner_commencement_declarations is 'Immutable partner-reported commencement evidence.';
comment on table public.partner_progress_updates is 'Immutable partner-reported execution progress evidence.';
comment on table public.partner_execution_exceptions is 'Partner-reported delivery blockers and exceptions.';
comment on table public.partner_delivery_submissions is 'Immutable partner delivery submission declaration for later internal review.';

commit;
