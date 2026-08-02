-- Overflow Partner OS: documents, tasks, activity and notifications

create type public.task_status as enum ('open','in_progress','blocked','completed','cancelled');
create type public.task_priority as enum ('low','normal','high','urgent');

alter table public.documents
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists technical_intake_id uuid references public.technical_intakes(id) on delete set null,
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists issued_at timestamptz;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  priority public.task_priority not null default 'normal',
  status public.task_status not null default 'open',
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint completed_task_has_timestamp check (status <> 'completed' or completed_at is not null)
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  link_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint read_notification_has_timestamp check (not is_read or read_at is not null)
);

create index if not exists documents_project_id_idx on public.documents(project_id);
create index if not exists documents_intake_id_idx on public.documents(technical_intake_id);
create index if not exists documents_quote_id_idx on public.documents(quote_id);
create index tasks_organisation_id_idx on public.tasks(organisation_id);
create index tasks_assigned_to_status_idx on public.tasks(assigned_to, status);
create index tasks_due_at_idx on public.tasks(due_at);
create index activity_events_entity_idx on public.activity_events(entity_type, entity_id);
create index activity_events_created_at_idx on public.activity_events(created_at desc);
create index notifications_user_read_idx on public.notifications(user_id, is_read);
