-- OPOS isolated QA handover repair: owner/admin visibility of private controlled PDF metadata.
-- This policy does not authorise public access or any document mutation.
DROP POLICY IF EXISTS opos_qa_owner_handover_storage_read ON storage.objects;
CREATE POLICY opos_qa_owner_handover_storage_read ON storage.objects
FOR SELECT TO authenticated
USING (
 bucket_id='opos-qa-controlled-handover'
 AND EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.is_active=true
   AND p.role::text IN ('owner','admin')
   AND p.organisation_id::text=split_part(objects.name,'/',1)
 )
);

-- Use the previously governed, actor-scoped financial settlement status RPC.
-- Do not make the confidential final settlement ledger directly selectable.
CREATE OR REPLACE FUNCTION public.op_qa_guard_handover_pack()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
 v_actor uuid:=auth.uid();
 v_object text;
 v_cycle integer;
BEGIN
 IF new.document_type<>'handover-pack' OR new.project_id IS NULL THEN RETURN NEW; END IF;
 IF tg_op='UPDATE' AND old.status IS NOT DISTINCT FROM new.status
    AND old.storage_path IS NOT DISTINCT FROM new.storage_path THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p
   WHERE p.id=v_actor AND p.organisation_id=new.organisation_id AND p.is_active
   AND p.role::text IN ('owner','admin')) THEN
  RAISE EXCEPTION 'Only a logged-in owner or administrator may change controlled Handover Pack evidence.';
 END IF;
 IF new.project_id IS DISTINCT FROM old.project_id
   OR new.organisation_id IS DISTINCT FROM old.organisation_id
   OR new.document_type IS DISTINCT FROM old.document_type
 THEN RAISE EXCEPTION 'Handover project and organisation are immutable.'; END IF;
 IF old.status::text NOT IN ('draft','changes_requested') AND new.storage_path IS DISTINCT FROM old.storage_path
 THEN RAISE EXCEPTION 'Reviewed Handover Pack evidence cannot be replaced.'; END IF;
 IF new.status::text IN ('in_review','signed','approved','issued','published') THEN
  IF new.storage_path IS NULL OR new.storage_path NOT LIKE
    'opos-qa-controlled-handover:'||new.organisation_id::text||'/'||new.project_id::text||'/'||new.id::text||'/%'
  THEN RAISE EXCEPTION 'A correctly scoped private controlled PDF is required.'; END IF;
  v_object:=substring(new.storage_path from length('opos-qa-controlled-handover:')+1);
  IF NOT EXISTS(SELECT 1 FROM storage.objects so WHERE so.bucket_id='opos-qa-controlled-handover'
   AND so.name=v_object AND so.metadata->>'mimetype'='application/pdf'
   AND coalesce((so.metadata->>'size')::bigint,0)>500) THEN
    RAISE EXCEPTION 'The controlled Handover Pack PDF is not present in QA private storage.';
  END IF;
 END IF;
 IF new.status::text IN ('approved','issued','published') THEN
   IF NOT coalesce((
     SELECT (public.op_project_voice_final_release_status(
       new.organisation_id,v_actor,new.project_id)->>'finalPaid')::boolean
   ),false)
   THEN RAISE EXCEPTION 'Independently verified final settlement is required before handover approval.'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.project_client_reviews r
     WHERE r.project_id=new.project_id AND r.organisation_id=new.organisation_id
     AND r.outcome IN ('accepted','accepted_with_comments')
     AND r.recorded_at=(SELECT max(t.recorded_at) FROM public.project_client_reviews t
                       WHERE t.project_id=new.project_id AND t.organisation_id=new.organisation_id))
   THEN RAISE EXCEPTION 'Latest accepted engineering review is required.'; END IF;
   SELECT coalesce(max(execution_cycle),1) INTO v_cycle
     FROM public.project_execution_assignments WHERE project_id=new.project_id AND organisation_id=new.organisation_id;
   IF NOT EXISTS(SELECT 1 FROM public.partner_delivery_submissions s
    WHERE s.project_id=new.project_id AND s.organisation_id=new.organisation_id
    AND s.execution_cycle=v_cycle AND s.review_status='accepted'
    AND EXISTS(SELECT 1 FROM public.partner_delivery_submission_files f WHERE f.submission_id=s.id
     AND f.project_id=new.project_id AND f.organisation_id=new.organisation_id))
   THEN RAISE EXCEPTION 'Current accepted partner engineering evidence required.'; END IF;
   IF new.signed_by IS NULL OR new.signed_at IS NULL THEN
    RAISE EXCEPTION 'Authenticated document signature evidence required.'; END IF;
 END IF;
 IF new.status::text IN ('issued','published') THEN
   IF new.approved_by IS NULL OR new.approved_at IS NULL OR new.issued_by IS NULL OR new.issued_at IS NULL
   THEN RAISE EXCEPTION 'Separate approved and issued document control identities required.'; END IF;
 END IF;
 RETURN NEW;
END;$function$

REVOKE ALL ON FUNCTION public.op_qa_guard_handover_pack() FROM PUBLIC,anon,authenticated;
