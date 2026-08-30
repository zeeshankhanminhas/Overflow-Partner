create or replace function public.op_developer_delete_test_record(p_entity_type text, p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
  v_type text := lower(trim(coalesce(p_entity_type,'')));
  v_project_id uuid;
  v_document_ids uuid[] := '{}';
  v_record_label text;
begin
  select coalesce(developer_delete_enabled,false)
    into v_allowed
  from public.profiles
  where id = auth.uid() and is_active = true;

  if not coalesce(v_allowed,false) then
    raise exception 'Developer test deletion is not enabled for this account.' using errcode='42501';
  end if;

  if v_type not in ('prospect','lead','project','document') then
    raise exception 'Unsupported developer delete entity type: %', v_type using errcode='22023';
  end if;

  if v_type = 'project' then
    select project_number into v_record_label
    from public.projects where id=p_entity_id;
    if not found then raise exception 'Project not found.' using errcode='P0002'; end if;

    select coalesce(array_agg(id),'{}'::uuid[]) into v_document_ids
    from public.documents where project_id=p_entity_id;

    delete from public.payments where project_id=p_entity_id;
    delete from public.partner_payments where project_id=p_entity_id;
    delete from public.partner_payables where project_id=p_entity_id;
    delete from public.invoices where project_id=p_entity_id;
    delete from public.projects where id=p_entity_id;

    if cardinality(v_document_ids)>0 then
      update public.project_execution_assignments set scope_document_id=null where scope_document_id=any(v_document_ids);
      delete from public.documents where id=any(v_document_ids);
    end if;

  elsif v_type = 'lead' then
    select coalesce(reference,title,company_name,id::text) into v_record_label
    from public.leads where id=p_entity_id;
    if not found then raise exception 'Case not found.' using errcode='P0002'; end if;

    for v_project_id in select id from public.projects where lead_id=p_entity_id loop
      perform public.op_developer_delete_test_record('project',v_project_id);
    end loop;

    select coalesce(array_agg(id),'{}'::uuid[]) into v_document_ids
    from public.documents where lead_id=p_entity_id;

    if cardinality(v_document_ids)>0 then
      update public.project_execution_assignments set scope_document_id=null where scope_document_id=any(v_document_ids);
      delete from public.documents where id=any(v_document_ids);
    end if;

    delete from public.payments where invoice_id in (select id from public.invoices where lead_id=p_entity_id);
    delete from public.invoices where lead_id=p_entity_id;
    delete from public.quote_acceptance_records where lead_id=p_entity_id;
    delete from public.quote_issue_records where lead_id=p_entity_id;
    delete from public.leads where id=p_entity_id;

  elsif v_type = 'prospect' then
    select coalesce(company_name,id::text) into v_record_label
    from public.prospects where id=p_entity_id;
    if not found then raise exception 'Opportunity not found.' using errcode='P0002'; end if;
    delete from public.prospects where id=p_entity_id;

  elsif v_type = 'document' then
    select coalesce(reference,title,id::text) into v_record_label
    from public.documents where id=p_entity_id;
    if not found then raise exception 'Document not found.' using errcode='P0002'; end if;
    update public.project_execution_assignments set scope_document_id=null where scope_document_id=p_entity_id;
    delete from public.documents where id=p_entity_id;
  end if;

  delete from public.activity_events
  where entity_id=p_entity_id
    and lower(entity_type) in (v_type, case when v_type='lead' then 'case' else v_type end);

  return jsonb_build_object('deleted',true,'entityType',v_type,'entityId',p_entity_id,'label',v_record_label);
end;
$$;

revoke all on function public.op_developer_delete_test_record(text,uuid) from public;
grant execute on function public.op_developer_delete_test_record(text,uuid) to authenticated;
