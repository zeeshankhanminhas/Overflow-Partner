begin;

-- Project setup follows the commercial release condition agreed in the issued
-- quote. A payment is one valid condition, but not the only valid condition.
create table if not exists public.quote_release_confirmations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  release_basis text not null check (release_basis in ('purchase_order','no_advance_payment')),
  evidence_reference text not null check (length(trim(evidence_reference)) > 0),
  notes text,
  confirmed_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organisation_id, quote_id),
  check (release_basis <> 'no_advance_payment' or nullif(trim(coalesce(notes,'')), '') is not null)
);

alter table public.quote_release_confirmations enable row level security;
drop policy if exists quote_release_confirmations_org_read on public.quote_release_confirmations;
create policy quote_release_confirmations_org_read
on public.quote_release_confirmations for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organisation_id = quote_release_confirmations.organisation_id
      and p.is_active = true
  )
);

revoke all on table public.quote_release_confirmations from public, anon, authenticated;
grant select on table public.quote_release_confirmations to authenticated;
grant all on table public.quote_release_confirmations to service_role;
create index if not exists ix_quote_release_confirmations_lead
  on public.quote_release_confirmations (organisation_id, lead_id);

create or replace function public.op_guard_project_client_acceptance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quote_id is null then
    raise exception 'OS_INTEGRITY: Project 360 requires a governed accepted Client Quote.';
  end if;
  if not exists (
    select 1 from public.quote_acceptance_records a
    where a.organisation_id = new.organisation_id and a.quote_id = new.quote_id
  ) then
    raise exception 'OS_INTEGRITY: Project 360 requires recorded written client acceptance evidence.';
  end if;
  if not exists (
    select 1 from public.quote_payment_confirmations p
    where p.organisation_id = new.organisation_id and p.quote_id = new.quote_id
  ) and not exists (
    select 1 from public.quote_release_confirmations r
    where r.organisation_id = new.organisation_id and r.quote_id = new.quote_id
  ) then
    raise exception 'OS_INTEGRITY: Project 360 requires evidence that the issued quote release condition has been met.';
  end if;
  return new;
end;
$$;

revoke all on function public.op_guard_project_client_acceptance() from public, anon, authenticated;
grant execute on function public.op_guard_project_client_acceptance() to service_role;

create or replace function public.op_accept_quote_create_project_with_release_evidence(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_acceptance_basis text,
  p_evidence_reference text,
  p_accepted_by_name text,
  p_accepted_by_email text default null,
  p_notes text default null,
  p_release_basis text default null,
  p_release_reference text default null,
  p_release_note text default null,
  p_payment_method text default null,
  p_payment_reference text default null,
  p_payment_confirmed_at timestamptz default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes;
  v_project public.projects;
begin
  perform public.op_assert_workspace_role(
    p_organisation_id,
    p_user_id,
    array['owner','admin','operator','commercial','business_development']
  );

  if p_release_basis = 'payment' then
    return public.op_accept_quote_create_project_with_payment_confirmation(
      p_organisation_id, p_user_id, p_quote_id,
      p_acceptance_basis, p_evidence_reference, p_accepted_by_name,
      p_accepted_by_email, p_notes, p_payment_method,
      p_payment_reference, p_payment_confirmed_at
    );
  end if;

  if p_release_basis is null or p_release_basis not in ('purchase_order','no_advance_payment') then
    raise exception 'Select the release condition agreed in the issued Client Quote.';
  end if;
  if nullif(trim(coalesce(p_release_reference,'')), '') is null then
    raise exception 'A purchase order or issued quote reference is required.';
  end if;
  if p_release_basis = 'no_advance_payment'
    and nullif(trim(coalesce(p_release_note,'')), '') is null then
    raise exception 'Record why no advance payment is due under the issued Client Quote.';
  end if;

  select * into v_quote
  from public.quotes
  where organisation_id = p_organisation_id and id = p_quote_id
  for update;
  if not found then raise exception 'Quote not found.'; end if;
  if v_quote.status::text <> 'issued' then raise exception 'Only an issued Quote can be released to Project 360.'; end if;
  if exists (
    select 1 from public.quote_payment_confirmations p
    where p.organisation_id = p_organisation_id and p.quote_id = p_quote_id
  ) then
    raise exception 'Payment evidence is already recorded for this quote. Continue using that release record.';
  end if;

  insert into public.quote_release_confirmations (
    organisation_id, quote_id, lead_id, release_basis, evidence_reference,
    notes, recorded_by
  ) values (
    p_organisation_id, v_quote.id, v_quote.lead_id, p_release_basis,
    trim(p_release_reference), nullif(trim(coalesce(p_release_note,'')), ''), p_user_id
  ) on conflict (organisation_id, quote_id) do nothing;

  if not exists (
    select 1 from public.quote_release_confirmations r
    where r.organisation_id = p_organisation_id and r.quote_id = p_quote_id
      and r.release_basis = p_release_basis
      and r.evidence_reference = trim(p_release_reference)
  ) then
    raise exception 'A different release condition is already recorded for this quote. Revise the quote before changing its commercial terms.';
  end if;

  perform public.op_record_activity(
    p_organisation_id, p_user_id, 'quote', v_quote.id,
    'quote_release_condition_confirmed',
    jsonb_build_object(
      'releaseBasis', p_release_basis,
      'evidenceReference', trim(p_release_reference),
      'releaseNote', nullif(trim(coalesce(p_release_note,'')), ''),
      'invariant', 'CLIENT_ACCEPTANCE_AND_AGREED_RELEASE_CONDITION_BEFORE_PROJECT'
    )
  );

  v_project := public.op_accept_quote_create_project_with_acceptance_core(
    p_organisation_id, p_user_id, p_quote_id,
    p_acceptance_basis, p_evidence_reference, p_accepted_by_name,
    p_accepted_by_email, p_notes
  );

  perform public.op_record_activity(
    p_organisation_id, p_user_id, 'project', v_project.id,
    'project_release_condition_satisfied',
    jsonb_build_object('quoteId', p_quote_id, 'releaseBasis', p_release_basis, 'canonicalLifecycle', true)
  );
  return v_project;
end;
$$;

revoke all on function public.op_accept_quote_create_project_with_release_evidence(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,timestamptz)
  from public, anon;
grant execute on function public.op_accept_quote_create_project_with_release_evidence(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,timestamptz)
  to authenticated, service_role;

commit;
