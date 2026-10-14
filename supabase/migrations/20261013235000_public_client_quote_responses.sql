begin;

alter table public.quote_issue_records
  add column if not exists client_response text,
  add column if not exists client_response_at timestamptz,
  add column if not exists client_response_note text;

alter table public.quote_issue_records
  drop constraint if exists quote_issue_records_client_response_check;
alter table public.quote_issue_records
  add constraint quote_issue_records_client_response_check
  check (client_response is null or client_response in ('accepted','declined','more_time'));

create or replace function public.op_record_public_quote_response(
  p_quote_id uuid,
  p_quote_revision integer,
  p_response text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.quote_issue_records;
  v_quote public.quotes;
begin
  if p_response not in ('accepted','declined','more_time') then
    raise exception 'Select a valid quotation response.';
  end if;

  select * into v_issue
  from public.quote_issue_records
  where quote_id = p_quote_id and quote_revision = p_quote_revision
  for update;
  if not found then raise exception 'Issued quotation not found.'; end if;
  if v_issue.client_response is not null then raise exception 'A response has already been recorded.'; end if;

  select * into v_quote from public.quotes where id = p_quote_id and organisation_id = v_issue.organisation_id for update;
  if not found or v_quote.revision <> p_quote_revision or v_quote.status::text <> 'issued' then
    raise exception 'This quotation is no longer awaiting a client response.';
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    raise exception 'This quotation has expired.';
  end if;

  update public.quote_issue_records
  set client_response = p_response, client_response_at = now()
  where id = v_issue.id
  returning * into v_issue;

  perform public.op_record_activity(
    v_issue.organisation_id, v_issue.recorded_by, 'quote', p_quote_id,
    'client_quote_response_recorded',
    jsonb_build_object('quoteRevision', p_quote_revision, 'response', p_response, 'recordedAt', v_issue.client_response_at, 'clientInitiated', true)
  );
  return jsonb_build_object('response', v_issue.client_response, 'recordedAt', v_issue.client_response_at);
end;
$$;

revoke all on function public.op_record_public_quote_response(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.op_record_public_quote_response(uuid, integer, text) to service_role;

commit;
