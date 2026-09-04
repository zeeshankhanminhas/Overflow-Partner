-- Extend the explicitly granted developer/test deletion capability to client
-- company master records. Operational Cases and Projects are preserved by the
-- existing ON DELETE SET NULL relationships.

create or replace function public.op_delete_test_record(
  p_entity_type text,
  p_entity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_table text;
  v_deleted integer := 0;
begin
  select p.organisation_id
    into v_org_id
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true
    and p.developer_delete_enabled = true;

  if v_org_id is null then
    raise exception 'Developer delete capability is not enabled for this account.' using errcode = '42501';
  end if;

  v_table := case lower(trim(p_entity_type))
    when 'prospect' then 'prospects'
    when 'case' then 'leads'
    when 'project' then 'projects'
    when 'document' then 'documents'
    when 'company' then 'companies'
    when 'invoice' then 'invoices'
    when 'partner_payable' then 'partner_payables'
    else null
  end;

  if v_table is null then
    raise exception 'Unsupported developer-delete entity type: %', p_entity_type;
  end if;

  execute format(
    'delete from public.%I where id = $1 and organisation_id = $2',
    v_table
  ) using p_entity_id, v_org_id;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    raise exception 'Record not found in your organisation, or it has already been deleted.';
  end if;

  return jsonb_build_object(
    'deleted', true,
    'entityType', lower(trim(p_entity_type)),
    'entityId', p_entity_id,
    'deletedRows', v_deleted
  );
end;
$$;

revoke all on function public.op_delete_test_record(text, uuid) from public;
grant execute on function public.op_delete_test_record(text, uuid) to authenticated;

create or replace function public.op_developer_delete_test_record(p_entity_type text, p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean := false;
  v_org_id uuid;
  v_type text := lower(trim(coalesce(p_entity_type,'')));
  v_project_id uuid;
  v_document_ids uuid[] := '{}';
  v_record_label text;
begin
  select coalesce(developer_delete_enabled,false), organisation_id
    into v_allowed, v_org_id
  from public.profiles
  where id = auth.uid() and is_active = true;

  if not coalesce(v_allowed,false) or v_org_id is null then
    raise exception 'Developer test deletion is not enabled for this account.' using errcode='42501';
  end if;

  if v_type not in ('prospect','lead','project','document','company') then
    raise exception 'Unsupported developer delete entity type: %', v_type using errcode='22023';
  end if;

  if v_type = 'project' then
    select project_number into v_record_label from public.projects where id=p_entity_id and organisation_id=v_org_id;
    if not found then raise exception 'Project not found.' using errcode='P0002'; end if;

    select coalesce(array_agg(id),'{}'::uuid[]) into v_document_ids from public.documents where project_id=p_entity_id and organisation_id=v_org_id;
    delete from public.payments where project_id=p_entity_id and organisation_id=v_org_id;
    delete from public.partner_payments where project_id=p_entity_id and organisation_id=v_org_id;
    delete from public.partner_payables where project_id=p_entity_id and organisation_id=v_org_id;
    delete from public.invoices where project_id=p_entity_id and organisation_id=v_org_id;
    delete from public.projects where id=p_entity_id and organisation_id=v_org_id;

    if cardinality(v_document_ids)>0 then
      update public.project_execution_assignments set scope_document_id=null where organisation_id=v_org_id and scope_document_id=any(v_document_ids);
      delete from public.notification_outbox where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.tasks where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.risk_register where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.compliance_register where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.workspace_pins where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.knowledge_entries where organisation_id=v_org_id and source_entity_type='document' and source_entity_id=any(v_document_ids);
      delete from public.activity_events where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.documents where organisation_id=v_org_id and id=any(v_document_ids);
    end if;

  elsif v_type = 'lead' then
    select coalesce(reference,title,company_name,id::text) into v_record_label from public.leads where id=p_entity_id and organisation_id=v_org_id;
    if not found then raise exception 'Case not found.' using errcode='P0002'; end if;
    for v_project_id in select id from public.projects where lead_id=p_entity_id and organisation_id=v_org_id loop
      perform public.op_developer_delete_test_record('project',v_project_id);
    end loop;
    select coalesce(array_agg(id),'{}'::uuid[]) into v_document_ids from public.documents where lead_id=p_entity_id and organisation_id=v_org_id;
    if cardinality(v_document_ids)>0 then
      update public.project_execution_assignments set scope_document_id=null where organisation_id=v_org_id and scope_document_id=any(v_document_ids);
      delete from public.notification_outbox where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.tasks where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.risk_register where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.compliance_register where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.workspace_pins where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.knowledge_entries where organisation_id=v_org_id and source_entity_type='document' and source_entity_id=any(v_document_ids);
      delete from public.activity_events where organisation_id=v_org_id and entity_type='document' and entity_id=any(v_document_ids);
      delete from public.documents where organisation_id=v_org_id and id=any(v_document_ids);
    end if;
    delete from public.payments where organisation_id=v_org_id and invoice_id in (select id from public.invoices where lead_id=p_entity_id and organisation_id=v_org_id);
    delete from public.invoices where lead_id=p_entity_id and organisation_id=v_org_id;
    delete from public.quote_acceptance_records where lead_id=p_entity_id and organisation_id=v_org_id;
    delete from public.quote_issue_records where lead_id=p_entity_id and organisation_id=v_org_id;
    delete from public.leads where id=p_entity_id and organisation_id=v_org_id;

  elsif v_type = 'prospect' then
    select coalesce(company_name,id::text) into v_record_label from public.prospects where id=p_entity_id and organisation_id=v_org_id;
    if not found then raise exception 'Opportunity not found.' using errcode='P0002'; end if;
    delete from public.prospects where id=p_entity_id and organisation_id=v_org_id;

  elsif v_type = 'document' then
    select coalesce(reference,title,id::text) into v_record_label from public.documents where id=p_entity_id and organisation_id=v_org_id;
    if not found then raise exception 'Document not found.' using errcode='P0002'; end if;
    update public.project_execution_assignments set scope_document_id=null where organisation_id=v_org_id and scope_document_id=p_entity_id;
    delete from public.documents where id=p_entity_id and organisation_id=v_org_id;

  elsif v_type = 'company' then
    select name into v_record_label from public.companies where id=p_entity_id and organisation_id=v_org_id;
    if not found then raise exception 'Client company not found.' using errcode='P0002'; end if;
    delete from public.companies where id=p_entity_id and organisation_id=v_org_id;
  end if;

  delete from public.notification_outbox where organisation_id=v_org_id and entity_id=p_entity_id and entity_type in (v_type,case when v_type='lead' then 'case' when v_type='company' then 'client' else v_type end);
  delete from public.tasks where organisation_id=v_org_id and entity_id=p_entity_id and entity_type in (v_type,case when v_type='lead' then 'case' when v_type='company' then 'client' else v_type end);
  delete from public.risk_register where organisation_id=v_org_id and entity_id=p_entity_id and entity_type in (v_type,case when v_type='lead' then 'case' when v_type='company' then 'client' else v_type end);
  delete from public.compliance_register where organisation_id=v_org_id and entity_id=p_entity_id and entity_type in (v_type,case when v_type='lead' then 'case' when v_type='company' then 'client' else v_type end);
  delete from public.workspace_pins where organisation_id=v_org_id and entity_id=p_entity_id and entity_type in (v_type,case when v_type='lead' then 'case' when v_type='company' then 'client' else v_type end);
  delete from public.knowledge_entries where organisation_id=v_org_id and source_entity_id=p_entity_id and source_entity_type in (v_type,case when v_type='lead' then 'case' when v_type='company' then 'client' else v_type end);
  delete from public.activity_events where organisation_id=v_org_id and entity_id=p_entity_id and entity_type in (v_type,case when v_type='lead' then 'case' when v_type='company' then 'client' else v_type end);

  return jsonb_build_object('deleted',true,'entityType',v_type,'entityId',p_entity_id,'label',v_record_label);
end;
$$;

revoke all on function public.op_developer_delete_test_record(text,uuid) from public;
grant execute on function public.op_developer_delete_test_record(text,uuid) to authenticated;
