begin;

-- Extend the existing quote status enum without assuming its type name.
do $$
declare
  status_type regtype;
begin
  select a.atttypid::regtype into status_type
  from pg_attribute a
  where a.attrelid = 'public.quotes'::regclass
    and a.attname = 'status'
    and not a.attisdropped;

  if exists (select 1 from pg_type where oid = status_type and typtype = 'e') then
    execute format('alter type %s add value if not exists %L', status_type, 'rejected');
    execute format('alter type %s add value if not exists %L', status_type, 'expired');
    execute format('alter type %s add value if not exists %L', status_type, 'withdrawn');
    execute format('alter type %s add value if not exists %L', status_type, 'superseded');
  end if;
end $$;

create or replace function public.op_has_controlled_quote_document(
  p_organisation_id uuid,
  p_quote_id uuid,
  p_lead_id uuid,
  p_required_status text
) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.documents d
    where d.organisation_id = p_organisation_id
      and d.document_type in ('client-quote', 'quote')
      and (d.quote_id = p_quote_id or (d.quote_id is null and d.lead_id = p_lead_id))
      and case
        when p_required_status = 'approved' then d.status::text in ('approved', 'issued', 'published')
        when p_required_status = 'issued' then d.status::text in ('issued', 'published')
        else d.status::text = p_required_status
      end
  );
$$;

create or replace function public.op_enforce_quote_document_gate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status::text = old.status::text then
    return new;
  end if;

  if new.status::text = 'issued' and not public.op_has_controlled_quote_document(new.organisation_id, new.id, new.lead_id, 'approved') then
    raise exception 'The controlled client quotation must be electronically signed and approved before the commercial quote can be issued.';
  end if;

  if new.status::text = 'accepted' and not public.op_has_controlled_quote_document(new.organisation_id, new.id, new.lead_id, 'issued') then
    raise exception 'The controlled client quotation must be issued before acceptance can create a project.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_quotes_controlled_document_gate on public.quotes;
create trigger trg_quotes_controlled_document_gate
before update of status on public.quotes
for each row execute function public.op_enforce_quote_document_gate();

create or replace function public.op_enforce_project_quote_document_gate()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_quote public.quotes;
begin
  if new.quote_id is null then
    raise exception 'A governed project must be created from an accepted quotation.';
  end if;

  select * into v_quote
  from public.quotes
  where id = new.quote_id
    and organisation_id = new.organisation_id;

  if not found or v_quote.status::text <> 'accepted' then
    raise exception 'A governed project requires an accepted quotation.';
  end if;

  if not public.op_has_controlled_quote_document(v_quote.organisation_id, v_quote.id, v_quote.lead_id, 'issued') then
    raise exception 'Project creation is blocked until the controlled client quotation is issued.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_projects_controlled_quote_gate on public.projects;
create trigger trg_projects_controlled_quote_gate
before insert on public.projects
for each row execute function public.op_enforce_project_quote_document_gate();

create or replace function public.op_record_quote_outcome(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_outcome text,
  p_note text default null
) returns public.quotes
language plpgsql security definer set search_path = public
as $$
declare
  v_quote public.quotes;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);

  if p_outcome not in ('rejected', 'expired', 'withdrawn') then
    raise exception 'Unsupported quotation outcome.';
  end if;

  select * into v_quote
  from public.quotes
  where organisation_id = p_organisation_id and id = p_quote_id
  for update;
  if not found then raise exception 'Quotation not found.'; end if;
  if v_quote.status::text not in ('draft', 'internal_review', 'issued') then
    raise exception 'Quotation cannot move from % to %.', v_quote.status, p_outcome;
  end if;

  update public.quotes
  set status = p_outcome,
      updated_at = now()
  where id = p_quote_id
  returning * into v_quote;

  perform public.op_record_activity(
    p_organisation_id,
    p_user_id,
    'lead',
    v_quote.lead_id,
    'quote_' || p_outcome,
    jsonb_build_object('quoteId', v_quote.id, 'quoteNumber', v_quote.quote_number, 'outcome', p_outcome, 'note', nullif(trim(coalesce(p_note, '')), ''))
  );

  return v_quote;
end;
$$;

create or replace function public.op_revise_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_note text default null
) returns public.quotes
language plpgsql security definer set search_path = public
as $$
declare
  v_quote public.quotes;
begin
  perform public.op_assert_membership(p_organisation_id, p_user_id);

  select * into v_quote
  from public.quotes
  where organisation_id = p_organisation_id and id = p_quote_id
  for update;
  if not found then raise exception 'Quotation not found.'; end if;
  if v_quote.status::text not in ('issued', 'rejected', 'expired', 'withdrawn') then
    raise exception 'Only a concluded or issued quotation can be revised.';
  end if;

  update public.quotes
  set status = 'draft',
      revision = coalesce(revision, 0) + 1,
      updated_at = now()
  where id = p_quote_id
  returning * into v_quote;

  update public.documents
  set status = 'archived', updated_at = now()
  where organisation_id = p_organisation_id
    and document_type in ('client-quote', 'quote')
    and (quote_id = p_quote_id or (quote_id is null and lead_id = v_quote.lead_id))
    and status::text in ('approved', 'issued', 'published');

  perform public.op_record_activity(
    p_organisation_id,
    p_user_id,
    'lead',
    v_quote.lead_id,
    'quote_revision_started',
    jsonb_build_object('quoteId', v_quote.id, 'quoteNumber', v_quote.quote_number, 'revision', v_quote.revision, 'note', nullif(trim(coalesce(p_note, '')), ''))
  );

  return v_quote;
end;
$$;

commit;
