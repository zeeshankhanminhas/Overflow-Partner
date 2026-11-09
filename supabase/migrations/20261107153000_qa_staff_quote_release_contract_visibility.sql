-- Read-only, organisation-scoped commercial release contract visibility.
-- Required by the authenticated OPOS Workspace final-settlement readiness page.
-- Does not grant write access, change financial evidence, or unlock deliverables.
GRANT SELECT ON TABLE public.quote_release_contracts TO authenticated;

DROP POLICY IF EXISTS opos_qa_staff_read_quote_release_contracts
ON public.quote_release_contracts;

CREATE POLICY opos_qa_staff_read_quote_release_contracts
ON public.quote_release_contracts
FOR SELECT TO authenticated
USING (
  organisation_id = public.current_organisation_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_active = true
      AND p.organisation_id = quote_release_contracts.organisation_id
      AND p.role::text IN ('owner','admin','operator','engineering','commercial')
  )
);
