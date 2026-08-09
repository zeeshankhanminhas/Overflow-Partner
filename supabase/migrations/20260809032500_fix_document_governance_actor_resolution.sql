begin;

create or replace function public.op_validate_document_governance()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_actor uuid;
  v_actor_authorised boolean := false;
begin
  if new.independent_review_required then
    new.governance_mode := 'independent_review';
  elsif new.governance_mode is null then
    new.governance_mode := 'owner_operated';
  end if;

  -- Resolve the authenticated actor only for legitimate controlled status transitions.
  -- This keeps direct/background writes from manufacturing approval identities.
  v_actor := auth.uid();
  if v_actor is not null then
    select exists (
      select 1
      from public.profiles p
      where p.id = v_actor
        and p.organisation_id = new.organisation_id
        and p.is_active = true
        and p.role::text in ('owner','admin')
    ) into v_actor_authorised;
  end if;

  -- Preserve any previously recorded governance identities.
  if tg_op = 'UPDATE' then
    new.signed_by := coalesce(new.signed_by, old.signed_by);
    new.approved_by := coalesce(new.approved_by, old.approved_by);
    new.issued_by := coalesce(new.issued_by, old.issued_by);
    new.signed_at := coalesce(new.signed_at, old.signed_at);
    new.approved_at := coalesce(new.approved_at, old.approved_at);
    new.issued_at := coalesce(new.issued_at, old.issued_at);
  end if;

  -- If a governed RPC performs the status transition, derive the authenticated
  -- owner/admin as the authority instead of requiring every producer to duplicate
  -- identity plumbing. Only exact allowed transitions may infer identity.
  if tg_op = 'UPDATE'
     and old.status::text = 'signed'
     and new.status::text = 'approved'
     and new.approved_by is null
     and v_actor_authorised then
    new.approved_by := v_actor;
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  if tg_op = 'UPDATE'
     and old.status::text = 'approved'
     and new.status::text in ('issued','published')
     and new.issued_by is null
     and v_actor_authorised then
    new.issued_by := v_actor;
    new.issued_at := coalesce(new.issued_at, now());
  end if;

  if new.governance_mode = 'independent_review'
     and new.approved_by is not null
     and new.signed_by is not null
     and new.approved_by = new.signed_by then
    raise exception 'Independent review is required: the document signer and approver must be different authorised users.';
  end if;

  if new.status::text in ('approved','issued','published') and new.approved_by is null then
    raise exception 'An authorised approval identity is required before this controlled document may progress.';
  end if;

  if new.status::text in ('issued','published') and new.issued_by is null then
    raise exception 'An authorised release identity is required before this controlled document may be issued.';
  end if;

  return new;
end;
$$;

comment on function public.op_validate_document_governance() is
  'Final document governance guard. Preserves recorded identities and may resolve the authenticated owner/admin for exact signed→approved and approved→issued transitions; independent review and identity requirements remain enforced.';

commit;
