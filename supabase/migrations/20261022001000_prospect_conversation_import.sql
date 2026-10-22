-- Add manual, immutable LinkedIn/Sales Navigator transcript archives to the existing Prospect.
-- Staged only: do not apply to production until isolated RLS/import QA passes.
create table if not exists public.prospect_conversation_imports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  source text not null check (source in ('linkedin', 'sales_navigator')),
  source_url text,
  original_text text not null check (length(original_text) between 1 and 60000),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  imported_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (prospect_id, source, content_hash)
);
create index if not exists prospect_conversation_imports_timeline
  on public.prospect_conversation_imports (organisation_id, prospect_id, created_at desc);

create table if not exists public.prospect_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  import_id uuid not null references public.prospect_conversation_imports(id) on delete cascade,
  source text not null check (source in ('linkedin','sales_navigator')),
  speaker text not null check (speaker in ('you','prospect','unknown')),
  body text not null check (length(body) between 1 and 20000),
  sent_at timestamptz,
  original_order integer not null check (original_order >= 0),
  message_fingerprint text not null check (message_fingerprint ~ '^[a-f0-9]{64}$'),
  imported_by uuid not null references public.profiles(id),
  imported_at timestamptz not null default now(),
  unique (prospect_id, message_fingerprint)
);
create index if not exists prospect_conversation_messages_timeline
  on public.prospect_conversation_messages (organisation_id, prospect_id, sent_at asc nulls last, imported_at asc);

alter table public.prospect_conversation_imports enable row level security;
alter table public.prospect_conversation_messages enable row level security;
revoke all on public.prospect_conversation_imports, public.prospect_conversation_messages from public, anon;
grant select, insert on public.prospect_conversation_imports, public.prospect_conversation_messages to authenticated;

-- RLS checks BOTH the signed-in, active organisation membership and the parent
-- Prospect. A caller cannot attach a message to a prospect in another organisation.
create policy "conversation imports read by organisation members"
on public.prospect_conversation_imports for select to authenticated
using (
  exists (select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.is_active
      and pr.organisation_id = prospect_conversation_imports.organisation_id
      and pr.role::text in ('owner','admin','business_development','operator'))
  and exists (select 1 from public.prospects p
    where p.id = prospect_conversation_imports.prospect_id
      and p.organisation_id = prospect_conversation_imports.organisation_id)
);
create policy "conversation imports created by authorised operators"
on public.prospect_conversation_imports for insert to authenticated
with check (
  imported_by = (select auth.uid())
  and exists (select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.is_active
      and pr.organisation_id = prospect_conversation_imports.organisation_id
      and pr.role::text in ('owner','admin','business_development','operator'))
  and exists (select 1 from public.prospects p
    where p.id = prospect_conversation_imports.prospect_id
      and p.organisation_id = prospect_conversation_imports.organisation_id
      and p.source::text = 'linkedin')
);
create policy "conversation messages read by organisation members"
on public.prospect_conversation_messages for select to authenticated
using (
  exists (select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.is_active
      and pr.organisation_id = prospect_conversation_messages.organisation_id
      and pr.role::text in ('owner','admin','business_development','operator'))
  and exists (select 1 from public.prospect_conversation_imports i
    where i.id = prospect_conversation_messages.import_id
      and i.prospect_id = prospect_conversation_messages.prospect_id
      and i.organisation_id = prospect_conversation_messages.organisation_id
      and i.source = prospect_conversation_messages.source)
);
create policy "conversation messages created by authorised operators"
on public.prospect_conversation_messages for insert to authenticated
with check (
  imported_by = (select auth.uid())
  and exists (select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.is_active
      and pr.organisation_id = prospect_conversation_messages.organisation_id
      and pr.role::text in ('owner','admin','business_development','operator'))
  and exists (select 1 from public.prospect_conversation_imports i
    where i.id = prospect_conversation_messages.import_id
      and i.prospect_id = prospect_conversation_messages.prospect_id
      and i.organisation_id = prospect_conversation_messages.organisation_id
      and i.source = prospect_conversation_messages.source)
);
-- Intentional: no UPDATE/DELETE policies; imports remain immutable evidence.
