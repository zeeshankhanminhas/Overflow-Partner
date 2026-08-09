-- Phase 2B — Project Delivery Control
-- First-class deliverables, milestones and dependencies for Project 360.
-- Idempotent by design so it can be safely re-run from the Supabase SQL editor.

create table if not exists public.project_delivery_items (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  item_type text not null default 'deliverable' check (item_type in ('deliverable','milestone','dependency')),
  title text not null,
  description text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','internal_review','ready_to_issue','client_review','complete','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  owner_id uuid references public.profiles(id) on delete set null,
  partner_id uuid references public.partners(id) on delete set null,
  depends_on_id uuid references public.project_delivery_items(id) on delete set null,
  due_date date,
  revision text,
  internal_review_status text not null default 'not_required' check (internal_review_status in ('not_required','pending','approved','changes_required')),
  client_review_status text not null default 'not_required' check (client_review_status in ('not_required','pending','accepted','changes_required')),
  linked_document_id uuid references public.documents(id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_delivery_complete_timestamp check (status <> 'complete' or completed_at is not null),
  constraint project_delivery_no_self_dependency check (depends_on_id is null or depends_on_id <> id)
);

create index if not exists project_delivery_items_project_idx on public.project_delivery_items(project_id, status);
create index if not exists project_delivery_items_owner_idx on public.project_delivery_items(owner_id, status);
create index if not exists project_delivery_items_partner_idx on public.project_delivery_items(partner_id, status);
create index if not exists project_delivery_items_due_idx on public.project_delivery_items(due_date) where status not in ('complete','cancelled');

alter table public.project_delivery_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_delivery_items' and policyname='organisation members can read project delivery items') then
    create policy "organisation members can read project delivery items"
      on public.project_delivery_items for select to authenticated
      using (organisation_id = public.current_organisation_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_delivery_items' and policyname='organisation members can create project delivery items') then
    create policy "organisation members can create project delivery items"
      on public.project_delivery_items for insert to authenticated
      with check (organisation_id = public.current_organisation_id() and created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_delivery_items' and policyname='organisation members can update project delivery items') then
    create policy "organisation members can update project delivery items"
      on public.project_delivery_items for update to authenticated
      using (organisation_id = public.current_organisation_id())
      with check (organisation_id = public.current_organisation_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_delivery_items' and policyname='organisation members can delete project delivery items') then
    create policy "organisation members can delete project delivery items"
      on public.project_delivery_items for delete to authenticated
      using (organisation_id = public.current_organisation_id());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname='project_delivery_items_set_updated_at') then
    create trigger project_delivery_items_set_updated_at
      before update on public.project_delivery_items
      for each row execute function public.set_updated_at();
  end if;
end $$;
