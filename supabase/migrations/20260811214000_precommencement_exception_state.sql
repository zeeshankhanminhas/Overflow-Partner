begin;

create or replace function public.op_resolve_partner_execution_exception(
  p_organisation_id uuid,
  p_user_id uuid,
  p_exception_id uuid,
  p_resolution_note text
) returns public.partner_execution_exceptions
language plpgsql security definer set search_path=public
as $$
declare
  v_exception public.partner_execution_exceptions;
  v_assignment public.project_execution_assignments;
  v_next_state text;
begin
  perform public.op_assert_membership(p_organisation_id,p_user_id);
  if nullif(trim(coalesce(p_resolution_note,'')),'') is null then raise exception 'Resolution note is required.'; end if;
  select * into v_exception from public.partner_execution_exceptions where id=p_exception_id and organisation_id=p_organisation_id for update;
  if not found then raise exception 'Execution exception not found.'; end if;
  if v_exception.status not in ('open','acknowledged') then raise exception 'This execution exception is already resolved or withdrawn.'; end if;

  update public.partner_execution_exceptions
  set status='resolved',resolved_at=now(),resolution_note=trim(p_resolution_note),updated_at=now()
  where id=v_exception.id returning * into v_exception;

  select * into v_assignment from public.project_execution_assignments where id=v_exception.assignment_id for update;
  if found and not exists(select 1 from public.partner_execution_exceptions where assignment_id=v_assignment.id and status in ('open','acknowledged')) then
    if not exists(select 1 from public.partner_commencement_declarations where assignment_id=v_assignment.id) then
      v_next_state:='awaiting_acknowledgement';
    elsif exists(select 1 from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle) then
      v_next_state:='delivery_submitted';
    else
      v_next_state:='executing';
    end if;
    update public.project_execution_assignments set execution_state=v_next_state,updated_at=now() where id=v_assignment.id;
  end if;

  perform public.op_record_activity(p_organisation_id,p_user_id,'project',v_exception.project_id,'partner_execution.exception_resolved',
    jsonb_build_object('exceptionId',v_exception.id,'resolutionNote',trim(p_resolution_note),'nextExecutionState',v_next_state));
  return v_exception;
end $$;

commit;
