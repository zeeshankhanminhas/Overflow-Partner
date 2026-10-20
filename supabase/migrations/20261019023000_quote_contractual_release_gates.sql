-- Authoritative issue-revision commercial terms.
-- FOR DEVELOPMENT REVIEW. Do not apply to shared OPOS until all callers, quote PDF and tests are verified.
create table if not exists public.quote_release_contracts (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id),
  quote_revision integer not null check (quote_revision > 0),
  release_basis text not null check (release_basis in ('payment','deposit','purchase_order','credit','no_advance_payment')),
  opening_amount numeric(18,2) not null check (opening_amount >= 0),
  currency text not null,
  authorised_contact_name text not null check (length(trim(authorised_contact_name)) > 1),
  authorised_contact_email text not null check (position('@' in authorised_contact_email)>1),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  primary key (quote_id,quote_revision)
);
create index if not exists quote_release_contracts_organisation_idx on public.quote_release_contracts (organisation_id, quote_id);
alter table public.quote_release_contracts enable row level security;
revoke all on public.quote_release_contracts from public,anon,authenticated;
grant select,insert,update on public.quote_release_contracts to service_role;

-- Operators can set the contractual condition only while the quotation is draft.
-- Subsequent revisions must create a new revision-specific record.
create or replace function public.op_record_quote_release_contract(
  p_organisation_id uuid,p_user_id uuid,p_quote_id uuid,p_release_basis text,
  p_opening_amount numeric,p_authorised_contact_name text,p_authorised_contact_email text)
returns public.quote_release_contracts
language plpgsql security definer set search_path=public
as $$
declare v_quote public.quotes%rowtype; v_row public.quote_release_contracts%rowtype;
begin
  perform public.op_assert_workspace_role(p_organisation_id,p_user_id,array['owner','admin','commercial','business_development']);
  select * into v_quote from public.quotes where id=p_quote_id and organisation_id=p_organisation_id for update;
  if not found or v_quote.status::text not in ('draft','internal_review') then
    raise exception 'Commercial terms can only be recorded on a draft Client Quote.';
  end if;
  if p_release_basis not in ('payment','deposit','purchase_order','credit','no_advance_payment') then
    raise exception 'Invalid contractual release basis.';
  end if;
  if nullif(trim(coalesce(p_authorised_contact_name,'')),'') is null or
     nullif(trim(coalesce(p_authorised_contact_email,'')),'') is null then
    raise exception 'The named authorised customer contact is required.';
  end if;
  if p_release_basis='payment' and (p_opening_amount is distinct from v_quote.total or v_quote.total<=0) then
    raise exception 'Full advance must equal the issued quote total.';
  elsif p_release_basis='deposit' and
    (p_opening_amount is null or p_opening_amount<=0 or p_opening_amount>=v_quote.total) then
    raise exception 'Deposit must be positive and below the quote total.';
  elsif p_release_basis in ('purchase_order','credit','no_advance_payment') and p_opening_amount is distinct from 0 then
    raise exception 'Non-payment release conditions must have zero opening charge.';
  end if;
  insert into public.quote_release_contracts (
    quote_id,organisation_id,quote_revision,release_basis,opening_amount,currency,
    authorised_contact_name,authorised_contact_email,approved_by
  ) values (
    v_quote.id,v_quote.organisation_id,v_quote.revision,p_release_basis,p_opening_amount,
    v_quote.currency,trim(p_authorised_contact_name),lower(trim(p_authorised_contact_email)),p_user_id
  )
  on conflict (quote_id,quote_revision) do update
  set release_basis=excluded.release_basis,opening_amount=excluded.opening_amount,
    currency=excluded.currency,authorised_contact_name=excluded.authorised_contact_name,
    authorised_contact_email=excluded.authorised_contact_email,
    approved_by=excluded.approved_by,approved_at=now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.op_record_quote_release_contract(uuid,uuid,uuid,text,numeric,text,text) from public,anon;
grant execute on function public.op_record_quote_release_contract(uuid,uuid,uuid,text,numeric,text,text) to authenticated,service_role;

create or replace function public.op_require_quote_contract_before_issue()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status::text='issued' and old.status::text<>'issued' then
    if not exists (
      select 1 from public.quote_release_contracts c
      where c.quote_id=new.id and c.organisation_id=new.organisation_id
        and c.quote_revision=new.revision and upper(c.currency)=upper(new.currency)
    ) then
      raise exception 'A revision-specific commercial release contract is required before quotation issue.';
    end if;
  end if;
  return new;
end;$$;
drop trigger if exists op_quote_contract_issue_gate on public.quotes;
create trigger op_quote_contract_issue_gate before update of status on public.quotes
for each row execute function public.op_require_quote_contract_before_issue();

-- An accepted quote and reconciled release evidence are prerequisites to project creation.
-- This trigger applies across manual bank/PO paths and Stripe's service-role finalizer.
-- Evidence of the named client's affirmative claim of signing authority. Secure-link
-- possession alone is not treated as verified legal identity.
create table if not exists public.quote_client_signatory_attestations (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id),
  quote_revision integer not null,
  signatory_name text not null,
  signatory_email text not null,
  authority_attested_at timestamptz not null default now(),
  primary key (quote_id,quote_revision)
);
alter table public.quote_client_signatory_attestations enable row level security;
revoke all on public.quote_client_signatory_attestations from public,anon,authenticated;
grant select,insert on public.quote_client_signatory_attestations to service_role;

create or replace function public.op_record_authorised_public_quote_response(
  p_quote_id uuid,p_quote_revision integer,p_response text,
  p_signatory_name text default null,p_signatory_email text default null,p_authority_attested boolean default false
) returns jsonb
language plpgsql security definer set search_path=public as $
declare v_contract public.quote_release_contracts%rowtype; v_issue public.quote_issue_records%rowtype;
begin
  if p_response='accepted' then
    if not p_authority_attested then raise exception 'Named signing authority attestation is required.'; end if;
    select * into v_contract from public.quote_release_contracts
    where quote_id=p_quote_id and quote_revision=p_quote_revision;
    if not found then raise exception 'Approved contractual terms are missing.'; end if;
    select * into v_issue from public.quote_issue_records
    where quote_id=p_quote_id and quote_revision=p_quote_revision;
    if not found or v_issue.organisation_id<>v_contract.organisation_id
      or lower(trim(v_issue.recipient_email))<>v_contract.authorised_contact_email then
      raise exception 'Authorised recipient and quote issue records do not match.'; end if;
    if lower(trim(coalesce(p_signatory_name,'')))<>lower(v_contract.authorised_contact_name) or
      lower(trim(coalesce(p_signatory_email,'')))<>v_contract.authorised_contact_email then
      raise exception 'The named signatory must match the authorised quotation contact.'; end if;
    insert into public.quote_client_signatory_attestations(
      quote_id,organisation_id,quote_revision,signatory_name,signatory_email
    ) values (
      p_quote_id,v_contract.organisation_id,p_quote_revision,
      trim(p_signatory_name),lower(trim(p_signatory_email))
    );
  end if;
  -- Both changes are one database transaction: a failed response rolls back attestation.
  return public.op_record_public_quote_response(p_quote_id,p_quote_revision,p_response);
end;$$;
revoke all on function public.op_record_authorised_public_quote_response(uuid,integer,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.op_record_authorised_public_quote_response(uuid,integer,text,text,text,boolean) to service_role;

create or replace function public.op_guard_project_contractual_release()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_quote public.quotes%rowtype; v_contract public.quote_release_contracts%rowtype;
begin
  if new.quote_id is null then
    raise exception 'Every commercial project must reference its authorised quote.';
  end if;
  select * into v_quote from public.quotes
  where id=new.quote_id and organisation_id=new.organisation_id;
  if not found then raise exception 'Commercial project quote not found.'; end if;
  select * into v_contract from public.quote_release_contracts
  where quote_id=v_quote.id and organisation_id=v_quote.organisation_id
    and quote_revision=v_quote.revision;
  if not found then raise exception 'No frozen release terms for accepted quote revision.'; end if;
  if upper(v_contract.currency)<>upper(v_quote.currency) then
    raise exception 'Commercial release currency differs from quoted terms.';
  end if;
  if not exists (
    select 1 from public.quote_acceptance_records a
    where a.quote_id=v_quote.id and a.organisation_id=v_quote.organisation_id
      and lower(trim(coalesce(a.accepted_by_email,'')))=lower(v_contract.authorised_contact_email)
      and lower(trim(a.accepted_by_name))=lower(v_contract.authorised_contact_name)
  ) then raise exception 'Named authorised client acceptance evidence is missing.'; end if;
  -- Automated portal acceptance requires explicit, matching named authority attestation.
  if exists (
    select 1 from public.quote_acceptance_records a
    where a.quote_id=v_quote.id and a.organisation_id=v_quote.organisation_id
      and a.acceptance_basis='client_portal'
  ) and not exists (
    select 1 from public.quote_client_signatory_attestations a
    where a.quote_id=v_quote.id and a.organisation_id=v_quote.organisation_id
      and a.quote_revision=v_quote.revision
      and lower(trim(a.signatory_email))=v_contract.authorised_contact_email
      and lower(trim(a.signatory_name))=lower(v_contract.authorised_contact_name)
  ) then
    raise exception 'Secure Client Portal acceptance lacks named signatory attestation.';
  end if;
  if v_contract.release_basis='payment' then
    if not exists (
      select 1 from public.quote_payment_confirmations p
      where p.quote_id=v_quote.id and p.organisation_id=v_quote.organisation_id
        and p.amount>=v_contract.opening_amount
        and upper(p.currency)=upper(v_contract.currency)
        and (
          (p.payment_method='bank_transfer' and false /* bank clearing must be verified by a separately reconciled bank feed */)
          or
          (p.payment_method='stripe' and exists (
            select 1 from public.quote_stripe_payment_events e
            where e.quote_id=v_quote.id and e.organisation_id=v_quote.organisation_id
              and e.quote_revision=v_quote.revision and e.stripe_payment_status='paid'
              and e.stripe_session_id=p.payment_reference
              and e.amount_total=round(v_contract.opening_amount*100)::bigint
              and upper(e.currency)=upper(v_contract.currency)
          ))
        )
    ) then raise exception 'Full advance has not been verified against accepted contractual terms.'; end if;
  elsif v_contract.release_basis in ('purchase_order','no_advance_payment') then
    if not exists (
      select 1 from public.quote_release_confirmations r
      where r.quote_id=v_quote.id and r.organisation_id=v_quote.organisation_id
        and r.release_basis=v_contract.release_basis and nullif(trim(r.evidence_reference),'') is not null
    ) then raise exception 'Authorised contractual release evidence is missing.'; end if;
  else
    raise exception 'Deposit and credit release require separately governed settlement workflows.';
  end if;
  return new;
end;$$;
drop trigger if exists op_project_contractual_release_gate on public.projects;
create trigger op_project_contractual_release_gate before insert on public.projects
for each row execute function public.op_guard_project_contractual_release();
