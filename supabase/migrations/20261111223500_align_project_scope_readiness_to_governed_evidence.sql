-- Preserve the original Project lifecycle gate while recognising the currently
-- governed evidence: approved Case Technical Scope and Client Requirements,
-- together with the current approved Project Statement of Work.
--
-- The obsolete separate "scope-of-work" document is dormant in the Workspace.
-- Do not discard the legacy blocker merely because the document is absent.
-- Clear it ONLY when the same tenant's linked Case/Quote/Project evidence
-- independently proves the approved delivery scope.
CREATE OR REPLACE FUNCTION public.op_project_stage_readiness(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_base jsonb;
  v_reasons jsonb;
  v_scope_attested boolean := false;
BEGIN
  SELECT organisation_id INTO v_org_id
  FROM public.projects WHERE id = p_project_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Project not found.';
  END IF;

  IF session_user <> 'postgres'
     AND coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
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

  -- All other existing requirements stay exactly as evaluated by the core.
  v_base := public.op_project_stage_readiness_with_duplicate_scope_gate(p_project_id);
  IF coalesce(v_base->>'stage', '') NOT IN ('mobilisation', 'ready_for_execution') THEN
    RETURN v_base;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.quotes q
      ON q.id = p.quote_id
     AND q.organisation_id = p.organisation_id
     AND q.lead_id = p.lead_id
    JOIN public.technical_intakes ti
      ON ti.organisation_id = p.organisation_id
     AND ti.lead_id = p.lead_id
     AND ti.status = 'approved'
    JOIN public.documents requirements
      ON requirements.organisation_id = p.organisation_id
     AND requirements.lead_id = p.lead_id
     AND requirements.document_type = 'client-requirements'
     AND requirements.status::text IN ('approved', 'issued', 'published')
     AND requirements.is_current_revision = true
    JOIN public.documents sow
      ON sow.organisation_id = p.organisation_id
     AND sow.project_id = p.id
     AND sow.document_type = 'statement-of-work'
     AND sow.status::text IN ('approved', 'issued', 'published')
     AND sow.is_current_revision = true
    WHERE p.id = p_project_id
      AND p.organisation_id = v_org_id
  ) INTO v_scope_attested;

  -- Incomplete, revoked or cross-tenant evidence leaves the gate unchanged.
  IF NOT v_scope_attested THEN
    RETURN v_base;
  END IF;

  SELECT coalesce(jsonb_agg(reason.value ORDER BY reason.ordinality), '[]'::jsonb)
  INTO v_reasons
  FROM jsonb_array_elements(coalesce(v_base->'reasons', '[]'::jsonb))
    WITH ORDINALITY AS reason(value, ordinality)
  WHERE reason.value #>> '{}' NOT IN (
    'Approved Scope of Work is required.',
    'An approved Scope of Work is required.',
    'Approved execution scope is required.'
  );

  RETURN v_base || jsonb_build_object(
    'reasons', v_reasons,
    'ready', jsonb_array_length(v_reasons) = 0
  );
END;
$function$;

-- Preserve the security boundary; the core is not a public Data API endpoint.
REVOKE ALL ON FUNCTION public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.op_project_stage_readiness_with_duplicate_scope_gate(uuid)
TO service_role;
