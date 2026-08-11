begin;

-- Internal lifecycle RPCs must never inherit PostgreSQL's default PUBLIC
-- EXECUTE grant. Anonymous external flows use dedicated token-scoped app/API
-- routes; internal business decisions require an authenticated workspace user.

revoke all on function public.op_convert_prospect(uuid,uuid,uuid) from public,anon;
revoke all on function public.op_approve_technical_intake(uuid,uuid,uuid) from public,anon;
revoke all on function public.op_create_commercial_review(uuid,uuid,uuid,numeric) from public,anon;
revoke all on function public.op_approve_commercial_generate_quote(uuid,uuid,uuid,text,numeric) from public,anon;
revoke all on function public.op_issue_quote_with_evidence(uuid,uuid,uuid,text,text,text,text,text) from public,anon;
revoke all on function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text) from public,anon;
revoke all on function public.op_record_client_transmittal_and_issue(uuid,uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.op_record_client_review_outcome(uuid,uuid,uuid,text,text,text,text) from public,anon;
revoke all on function public.op_resolve_partner_execution_exception(uuid,uuid,uuid,text) from public,anon;
revoke all on function public.op_advance_project_stage(uuid,text,uuid,text) from public,anon;
revoke all on function public.op_project_stage_readiness(uuid) from public,anon;

grant execute on function public.op_convert_prospect(uuid,uuid,uuid) to authenticated,service_role;
grant execute on function public.op_approve_technical_intake(uuid,uuid,uuid) to authenticated,service_role;
grant execute on function public.op_create_commercial_review(uuid,uuid,uuid,numeric) to authenticated,service_role;
grant execute on function public.op_approve_commercial_generate_quote(uuid,uuid,uuid,text,numeric) to authenticated,service_role;
grant execute on function public.op_issue_quote_with_evidence(uuid,uuid,uuid,text,text,text,text,text) to authenticated,service_role;
grant execute on function public.op_accept_quote_create_project_with_acceptance(uuid,uuid,uuid,text,text,text,text,text) to authenticated,service_role;
grant execute on function public.op_record_client_transmittal_and_issue(uuid,uuid,uuid,text,text,text,text) to authenticated,service_role;
grant execute on function public.op_record_client_review_outcome(uuid,uuid,uuid,text,text,text,text) to authenticated,service_role;
grant execute on function public.op_resolve_partner_execution_exception(uuid,uuid,uuid,text) to authenticated,service_role;
grant execute on function public.op_advance_project_stage(uuid,text,uuid,text) to authenticated,service_role;
grant execute on function public.op_project_stage_readiness(uuid) to authenticated,service_role;

-- Historical bypass RPCs remain defined only to fail closed for stale callers;
-- do not expose them through PostgREST.
revoke all on function public.op_issue_quote(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.op_accept_quote_create_project(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.op_issue_quote(uuid,uuid,uuid) to service_role;
grant execute on function public.op_accept_quote_create_project(uuid,uuid,uuid) to service_role;

-- Readiness implementation layers are internal helpers. Only the canonical
-- wrapper above is part of the authenticated application contract.
do $$
declare f regprocedure;
begin
  foreach f in array array[
    to_regprocedure('public.op_project_stage_readiness_core(uuid)'),
    to_regprocedure('public.op_project_stage_readiness_evidence(uuid)'),
    to_regprocedure('public.op_project_stage_readiness_evidence_core(uuid)')
  ] loop
    if f is not null then
      execute format('revoke all on function %s from public, anon, authenticated',f);
      execute format('grant execute on function %s to service_role',f);
    end if;
  end loop;
end $$;

-- Trigger helpers are not API endpoints.
do $$
declare f regprocedure;
begin
  foreach f in array array[
    to_regprocedure('public.op_guard_case_partner_review_creation()'),
    to_regprocedure('public.op_guard_project_client_acceptance()'),
    to_regprocedure('public.op_guard_project_execution_assignment()'),
    to_regprocedure('public.op_guard_partner_delivery_cycle()'),
    to_regprocedure('public.op_guard_partner_delivery_file_identity()'),
    to_regprocedure('public.op_enforce_quote_document_gate()'),
    to_regprocedure('public.op_integrity_guard_project_transition()')
  ] loop
    if f is not null then
      execute format('revoke all on function %s from public, anon, authenticated',f);
      execute format('grant execute on function %s to service_role',f);
    end if;
  end loop;
end $$;

commit;
