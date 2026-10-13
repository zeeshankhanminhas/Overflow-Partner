begin;

-- A draft Client Quote needs an explicit expiry before it can enter controlled
-- review. Record that commercial term without changing price or quote status.
create or replace function public.op_set_draft_quote_validity(
  p_organisation_id uuid,
  p_user_id uuid,
  p_quote_id uuid,
  p_valid_until date
) returns public.quotes
language plpgsql security definer set search_path=public
as $$
declare
  v_quote public.quotes;
begin
  perform public.op_assert_workspace_role(
    p_organisation_id, p_user_id,
    array['owner','admin','commercial']
  );
  if p_valid_until is null or p_valid_until < current_date then
    raise exception 'Quotation expiry must be today or a future date.';
  end if;

  select * into v_quote
  from public.quotes
  where organisation_id=p_organisation_id and id=p_quote_id
  for update;
  if not found then raise exception 'Client Quote not found.'; end if;
  if v_quote.status::text <> 'draft' then
    raise exception 'Only a draft Client Quote can have its validity recorded.';
  end if;
  if not exists(
    select 1 from public.documents d
    where d.organisation_id=p_organisation_id and d.quote_id=p_quote_id
      and d.document_type='client-quote' and d.is_current_revision=true
      and d.status::text in ('draft','changes_requested')
  ) then
    raise exception 'The current Client Quote document must be a working draft.';
  end if;

  update public.quotes
  set valid_until=p_valid_until,updated_at=now()
  where organisation_id=p_organisation_id and id=p_quote_id
  returning * into v_quote;

  perform public.op_record_activity(
    p_organisation_id,p_user_id,'quote',v_quote.id,'quote_validity_recorded',
    jsonb_build_object('validUntil',v_quote.valid_until,'canonicalLifecycle',true)
  );
  return v_quote;
end $$;

revoke all on function public.op_set_draft_quote_validity(uuid,uuid,uuid,date) from public,anon;
grant execute on function public.op_set_draft_quote_validity(uuid,uuid,uuid,date) to authenticated,service_role;

commit;
