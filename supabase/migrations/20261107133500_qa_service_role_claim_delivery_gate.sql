-- OPOS-QA ONLY: Supabase auth.role() supports both legacy and JSON JWT claim layouts.
-- Preserve the original privileged-versus-authenticated-organisation authorization gate.
-- Do not apply to production without separate review.
CREATE OR REPLACE FUNCTION public.op_qa_delivery_gate(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_org uuid;v_stage text;v_actor uuid:=auth.uid();v_assignment uuid;v_cycle int;v_submission uuid;
 v_revision text;v_files jsonb:='[]'::jsonb;v_hash text;v_count int:=0;v_present int:=0;
 v_review uuid;v_verified uuid;v_authorised uuid;
begin
 select organisation_id,project_stage into v_org,v_stage from public.projects where id=p_project_id;
 if v_org is null then raise exception 'Project not found'; end if;
 if session_user <> 'postgres' and coalesce(auth.role(),'') <> 'service_role'
 and not exists(select 1 from public.profiles where id=v_actor and organisation_id=v_org and is_active=true)
 then raise exception 'Authenticated organisation membership required'; end if;
 select id,execution_cycle into v_assignment,v_cycle from public.project_execution_assignments
 where project_id=p_project_id and organisation_id=v_org and execution_state not in ('closed','cancelled')
 order by created_at desc limit 1;
 select id,revision into v_submission,v_revision from public.partner_delivery_submissions
 where project_id=p_project_id and organisation_id=v_org and assignment_id=v_assignment and execution_cycle=v_cycle
 and submitted_at is not null and review_status not in ('withdrawn','rejected')
 order by submitted_at desc,id desc limit 1;
 if v_submission is not null then
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'filename',f.original_filename,'bucket',f.storage_bucket,
 'path',f.storage_path,'size',f.size_bytes) order by f.id),'[]'::jsonb),count(*)::int,count(o.name)::int
 into v_files,v_count,v_present from public.partner_delivery_submission_files f
 left join storage.objects o on o.bucket_id=f.storage_bucket and o.name=f.storage_path
 where f.project_id=p_project_id and f.organisation_id=v_org and f.submission_id=v_submission
 and f.assignment_id=v_assignment and f.execution_cycle=v_cycle;
 end if;
 v_hash:=md5(v_files::text);
 select r.id into v_review from public.op_qa_engineering_reviews r
 where r.project_id=p_project_id and r.organisation_id=v_org and r.assignment_id=v_assignment
 and r.submission_id=v_submission and r.execution_cycle=v_cycle and r.revision=coalesce(v_revision,'')
 and r.manifest_hash=v_hash and r.decision='accepted' order by r.signed_at desc limit 1;
 if v_review is not null then
  select c.id into v_verified from public.op_qa_manifest_verifications c
  where c.project_id=p_project_id and c.organisation_id=v_org and c.submission_id=v_submission
  and c.review_id=v_review and c.manifest_hash=v_hash limit 1;
 end if;
 if v_verified is not null then
  select a.id into v_authorised from public.op_qa_release_authorisations a
  where a.project_id=p_project_id and a.organisation_id=v_org and a.submission_id=v_submission
  and a.review_id=v_review and a.verification_id=v_verified and a.manifest_hash=v_hash limit 1;
 end if;
 return jsonb_build_object('project_stage',v_stage,'submission_id',v_submission,'assignment_id',v_assignment,
 'execution_cycle',v_cycle,'revision',v_revision,'files',v_files,'manifest_hash',v_hash,
 'file_count',v_count,'storage_complete',v_count>0 and v_count=v_present,
 'review_id',v_review,'engineering_accepted',v_review is not null and v_count>0 and v_count=v_present,
 'verification_id',v_verified,'manifest_verified',v_verified is not null and v_count>0 and v_count=v_present,
 'authorisation_id',v_authorised,'release_authorised',v_authorised is not null and v_count>0 and v_count=v_present);
end $function$

