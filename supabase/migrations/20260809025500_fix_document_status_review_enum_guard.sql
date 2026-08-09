begin;

-- Fix legacy document-status comparison that referenced the invalid enum literal `review`.
-- document_status uses `in_review`; comparisons must be performed as text so legacy aliases
-- never force PostgreSQL to cast an invalid literal into the enum.
create or replace function public.op_integrity_guard_document_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text := case when old.status::text = 'review' then 'in_review' else old.status::text end;
  v_new text := case when new.status::text = 'review' then 'in_review' else new.status::text end;
begin
  if v_old is not distinct from v_new then
    return new;
  end if;

  if not (
    (v_old='draft' and v_new in ('in_review','signed')) or
    (v_old='in_review' and v_new in ('changes_requested','signed','approved')) or
    (v_old='changes_requested' and v_new in ('draft','in_review')) or
    (v_old='signed' and v_new in ('approved','changes_requested')) or
    (v_old='approved' and v_new in ('issued','changes_requested')) or
    (v_old='issued' and v_new in ('published','archived','superseded')) or
    (v_old='published' and v_new in ('archived','superseded')) or
    (v_old='superseded' and v_new='archived')
  ) then
    raise exception 'OS_INTEGRITY: Invalid controlled document transition % -> %.', v_old, v_new;
  end if;

  return new;
end;
$$;

commit;
