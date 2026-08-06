begin;

alter table public.documents
  add column if not exists governance_mode text not null default 'owner_operated',
  add column if not exists independent_review_required boolean not null default false,
  add column if not exists prepared_by uuid,
  add column if not exists signed_by uuid,
  add column if not exists approved_by uuid,
  add column if not exists issued_by uuid,
  add column if not exists signed_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists issued_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'documents_governance_mode_check'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_governance_mode_check
      check (governance_mode in ('owner_operated', 'independent_review'));
  end if;
end $$;

update public.documents
set governance_mode = case
  when independent_review_required then 'independent_review'
  else 'owner_operated'
end
where governance_mode is null
   or governance_mode not in ('owner_operated', 'independent_review');

comment on column public.documents.governance_mode is
  'Owner-operated permits the same authorised owner to sign, approve and issue with separately audited declarations. Independent-review mode requires a different signer and approver.';

comment on column public.documents.independent_review_required is
  'Optional higher-risk control. When true, the authenticated signer and approver must be different users.';

create or replace function public.op_validate_document_governance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.independent_review_required then
    new.governance_mode := 'independent_review';
  elsif new.governance_mode is null then
    new.governance_mode := 'owner_operated';
  end if;

  if new.governance_mode = 'independent_review'
     and new.approved_by is not null
     and new.signed_by is not null
     and new.approved_by = new.signed_by then
    raise exception 'Independent review is required: the document signer and approver must be different authorised users.';
  end if;

  if new.status::text in ('approved', 'issued', 'published') and new.approved_by is null then
    raise exception 'An authorised approval identity is required before this controlled document may progress.';
  end if;

  if new.status::text in ('issued', 'published') and new.issued_by is null then
    raise exception 'An authorised release identity is required before this controlled document may be issued.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documents_validate_governance on public.documents;
create trigger trg_documents_validate_governance
before insert or update on public.documents
for each row execute function public.op_validate_document_governance();

commit;
