-- Release security hardening: preserve authenticated workspace RPC but scope the result to its organisation.
-- Trusted Postgres admin/CI and verified service_role invocations remain operational.
CREATE OR REPLACE FUNCTION public.op_project_stage_readiness(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_org_id uuid;
  v_base jsonb;
  v_reasons jsonb;
begin
  select organisation_id into v_org_id from public.projects where id=p_project_id;
  if v_org_id is null then raise exception 'Project not found.'; end if;
  if session_user <> 'postgres' and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then
    if auth.uid() is null or not exists (
      select 1 from public.profiles where id=auth.uid() and organisation_id=v_org_id
    ) then
      raise exception 'Project readiness requires authenticated organisation membership.';
    end if;
  end if;
  v_base:=public.op_project_stage_readiness_with_duplicate_scope_gate(p_project_id);
  select coalesce(jsonb_agg(reason.value order by reason.ordinality),'[]'::jsonb)
  into v_reasons
  from jsonb_array_elements(coalesce(v_base->'reasons','[]'::jsonb)) with ordinality as reason(value,ordinality)
  where reason.value #>> '{}' not in (
    'Approved Scope of Work is required.',
    'An approved Scope of Work is required.',
    'Approved execution scope is required.'
  );
  return v_base||jsonb_build_object('reasons',v_reasons,'ready',jsonb_array_length(v_reasons)=0);
end $function$;
-- Authenticated portal calls must use the scoped wrapper, not the privileged internal helper.
REVOKE ALL ON FUNCTION public.op_project_stage_readiness_with_duplicate_scope_gate(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.op_project_stage_readiness_with_duplicate_scope_gate(uuid) TO service_role;
-- Trigger-only functions are not public RPC entrypoints.
REVOKE ALL ON FUNCTION public.op_guard_manual_voice_project_closure() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.op_guard_partner_payment_after_final_release() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.op_guard_project_contractual_release() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.op_inherit_quote_release_to_project() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.op_require_quote_contract_before_issue() FROM PUBLIC,anon,authenticated;
-- Signed webhook service_role remains the only writer of immutable provider evidence.
REVOKE ALL ON TABLE public.quote_stripe_payment_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.quote_stripe_payment_events TO service_role;
