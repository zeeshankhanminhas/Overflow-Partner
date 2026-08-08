-- Developer/tester destructive data capability.
-- This permission is deliberately separate from owner/admin/commercial roles.
-- It is deny-by-default and must be granted explicitly to one profile in Supabase.

alter table public.profiles
  add column if not exists developer_delete_enabled boolean not null default false;

comment on column public.profiles.developer_delete_enabled is
  'Identity-specific destructive test-data permission. Never infer this from application role.';

create or replace function public.op_can_delete_test_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.developer_delete_enabled = true
  );
$$;

revoke all on function public.op_can_delete_test_data() from public;
grant execute on function public.op_can_delete_test_data() to authenticated;

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
    when 'invoice' then 'invoices'
    when 'partner_payable' then 'partner_payables'
    when 'risk' then 'risk_register'
    when 'compliance' then 'compliance_register'
    when 'knowledge' then 'knowledge_entries'
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

-- IMPORTANT: grant the capability manually to exactly one developer/tester profile.
-- Do not grant it by role. Example (replace with the intended profile UUID):
-- update public.profiles
-- set developer_delete_enabled = true
-- where id = '00000000-0000-0000-0000-000000000000';
--
-- Optional safety check after granting:
-- select id, full_name, email, role, developer_delete_enabled
-- from public.profiles
-- where developer_delete_enabled = true;
