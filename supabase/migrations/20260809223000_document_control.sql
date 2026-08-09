-- Overflow Partner: Phase 2C engineering document control
-- Adds revision lineage and issue history without replacing the existing document workflow.

alter table public.documents
  add column if not exists revision_code text,
  add column if not exists issue_purpose text,
  add column if not exists control_state text,
  add column if not exists supersedes_document_id uuid references public.documents(id) on delete set null,
  add column if not exists superseded_by_document_id uuid references public.documents(id) on delete set null,
  add column if not exists is_current_revision boolean not null default true,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by uuid references public.profiles(id) on delete set null,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by uuid references public.profiles(id) on delete set null;

update public.documents
set revision_code = coalesce(revision_code, 'P' || lpad(greatest(coalesce(version,1),1)::text, 2, '0')),
    issue_purpose = coalesce(issue_purpose, 'internal'),
    control_state = coalesce(control_state,
      case
        when status::text = 'draft' then 'working'
        when status::text in ('in_review','changes_requested','signed') then 'review'
        when status::text = 'approved' then 'approved'
        when status::text in ('issued','published') then 'issued'
        when status::text = 'superseded' then 'superseded'
        else 'working'
      end),
    is_current_revision = case when status::text = 'superseded' then false else coalesce(is_current_revision,true) end
where revision_code is null or issue_purpose is null or control_state is null;

alter table public.documents
  alter column revision_code set default 'P01',
  alter column issue_purpose set default 'internal',
  alter column control_state set default 'working';

create index if not exists documents_revision_lineage_idx on public.documents(organisation_id, supersedes_document_id);
create index if not exists documents_current_revision_idx on public.documents(organisation_id, project_id, lead_id, document_type, is_current_revision);
create index if not exists documents_control_state_idx on public.documents(organisation_id, control_state);

create table if not exists public.document_issue_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  revision_code text not null,
  issue_sequence integer not null check (issue_sequence > 0),
  purpose text not null default 'controlled_release',
  recipient_name text,
  recipient_email text,
  notes text,
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organisation_id, document_id, issue_sequence)
);

create index if not exists document_issue_records_document_idx on public.document_issue_records(document_id, issue_sequence desc);
create index if not exists document_issue_records_project_idx on public.document_issue_records(project_id, issued_at desc);
create index if not exists document_issue_records_lead_idx on public.document_issue_records(lead_id, issued_at desc);

alter table public.document_issue_records enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='document_issue_records' and policyname='organisation members can read document issues') then
    create policy "organisation members can read document issues"
      on public.document_issue_records for select to authenticated
      using (organisation_id = public.current_organisation_id());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='document_issue_records' and policyname='organisation members can create document issues') then
    create policy "organisation members can create document issues"
      on public.document_issue_records for insert to authenticated
      with check (organisation_id = public.current_organisation_id() and issued_by = auth.uid());
  end if;
end $$;
