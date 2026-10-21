-- Restore the governed Scope of Work release gate.
-- The previous wrapper removed approved-scope blockers from readiness output,
-- which allowed project transitions to ignore the original evidence gate.
-- Retain organisation membership checks and return the complete evidence result.
CREATE OR REPLACE FUNCTION public.op_project_stage_readiness(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT organisation_id INTO v_org_id
  FROM public.projects
  WHERE id = p_project_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found.';
  END IF;

  IF session_user <> 'postgres'
     AND coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
  THEN
    IF auth.uid() IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND organisation_id = v_org_id
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Project readiness requires authenticated organisation membership.';
    END IF;
  END IF;

  -- Never discard the core's Approved Scope of Work or Approved Statement
  -- of Work blockers. The lifecycle transition RPC consumes this ready flag.
  RETURN public.op_project_stage_readiness_with_duplicate_scope_gate(p_project_id);
END;
$function$;

-- Do not expose the privileged internal readiness implementation as a direct
-- Data API RPC. Only the authenticated, organisation-scoped wrapper is callable.
REVOKE ALL ON FUNCTION public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)
TO service_role;
