begin;

create table if not exists public.quote_issue_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  quote_revision integer not null,
  recipient_name text not null,
  recipient_email text,
  delivery_method text not null check (delivery_method in ('external_email','secure_link','client_portal','other')),
  evidence_reference text not null,
  note text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organisation_id, quote_id, quote_revision)
);

create index if not exists quote_issue_records_quote_idx on public.quote_issue_records(organisation_id,quote_id,quote_revision desc);
alter table public.quote_issue_records enable row level security;
drop policy if exists quote_issue_records_org_access on public.quote_issue_records;
create policy quote_issue_records_org_access on public.quote_issue_records
for all using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=quote_issue_records.organisation_id and p.is_active=true)
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.organisation_id=quote_issue_records.organisation_id and p.is_active=true)
);

create or replace function public.op_issue_quote_with_evidence(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_recipient_name text,
  p_recipient_email text,
  p_delivery_method text,
  p_evidence_reference text,
  p_note text default null
) returns public.quotes
language plpgsql security definer set search_path=public
as $$
declare
  v_quote public.quotes;
  v_document public.documents;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if p_delivery_method not in ('external_email','secure_link','client_portal','other') then raise exception 'Select a valid quotation delivery method.'; end if;
  if nullif(trim(coalesce(p_recipient_name,'')),'') is null then raise exception 'Quotation recipient name is required.'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'Quotation issue evidence reference is required.'; end if;

  select * into v_quote from public.quotes where organisation_id=p_organisation_id and id=p_quote_id for update;
  if not found then raise exception 'Client Quote not found.'; end if;
  if v_quote.status::text not in ('draft','internal_review') then raise exception 'Only a draft or internally reviewed Client Quote can be issued.'; end if;

  select * into v_document from public.documents
  where organisation_id=p_organisation_id and quote_id=p_quote_id and document_type='client-quote'
    and status::text in ('approved','issued','published') and is_current_revision=true
  order by updated_at desc limit 1;
  if not found then raise exception 'Approved canonical Client Quote document is required before commercial issue.'; end if;

  if exists(select 1 from public.quote_issue_records where organisation_id=p_organisation_id and quote_id=p_quote_id and quote_revision=v_quote.revision) then
    raise exception 'This quotation revision already has a recorded commercial issue event.';
  end if;

  insert into public.quote_issue_records(
    organisation_id,quote_id,lead_id,quote_revision,recipient_name,recipient_email,delivery_method,evidence_reference,note,recorded_by
  ) values(
    p_organisation_id,v_quote.id,v_quote.lead_id,v_quote.revision,trim(p_recipient_name),nullif(trim(coalesce(p_recipient_email,'')),''),
    p_delivery_method,trim(p_evidence_reference),nullif(trim(coalesce(p_note,'')),''),p_user_id
  );

  update public.quotes set status='issued',issued_at=now(),updated_at=now() where id=p_quote_id returning * into v_quote;
  update public.leads set status='quoted',next_action='Await written client decision',updated_at=now() where organisation_id=p_organisation_id and id=v_quote.lead_id;
  update public.documents set status='issued'::public.document_status,issued_at=coalesce(issued_at,now()),updated_at=now()
  where id=v_document.id and status::text='approved';

  perform public.op_record_activity(p_organisation_id,p_user_id,'quote',p_quote_id,'client_quote_issued',
    jsonb_build_object('quoteRevision',v_quote.revision,'recipientName',trim(p_recipient_name),'recipientEmail',nullif(trim(coalesce(p_recipient_email,'')),''),
      'deliveryMethod',p_delivery_method,'evidenceReference',trim(p_evidence_reference),'canonicalLifecycle',true));
  return v_quote;
end $$;

create or replace function public.op_issue_quote(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid
) returns public.quotes
language plpgsql security definer set search_path=public
as $$
begin
  raise exception 'OS_INTEGRITY: Commercial issue requires recipient, delivery method and evidence reference. Use the governed quote issue workflow.';
end $$;

grant execute on function public.op_issue_quote_with_evidence(uuid,uuid,uuid,text,text,text,text,text) to authenticated;

commit;
