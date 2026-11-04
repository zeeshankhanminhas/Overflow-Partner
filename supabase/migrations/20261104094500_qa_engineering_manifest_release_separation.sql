
-- QA isolation only. Engineering acceptance, manifest verification and client release are separate, immutable decisions.
create table public.op_qa_engineering_reviews(
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations(id),
 project_id uuid not null references public.projects(id),assignment_id uuid not null references public.project_execution_assignments(id),
 submission_id uuid not null references public.partner_delivery_submissions(id),execution_cycle int not null,revision text not null,
 manifest jsonb not null,manifest_hash text not null,decision text not null check(decision in ('accepted','correction_required','rejected')),
 checklist jsonb not null,findings text not null,reviewer_id uuid not null references auth.users(id),
 signed_at timestamptz not null default now(),unique(project_id,submission_id));
create table public.op_qa_manifest_verifications(
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations(id),
 project_id uuid not null references public.projects(id),submission_id uuid not null references public.partner_delivery_submissions(id),
 review_id uuid not null references public.op_qa_engineering_reviews(id),manifest_hash text not null,
 verified_by uuid not null references auth.users(id),verified_at timestamptz not null default now(),unique(project_id,submission_id));
create table public.op_qa_release_authorisations(
 id uuid primary key default gen_random_uuid(),organisation_id uuid not null references public.organisations(id),
 project_id uuid not null references public.projects(id),submission_id uuid not null references public.partner_delivery_submissions(id),
 review_id uuid not null references public.op_qa_engineering_reviews(id),
 verification_id uuid not null references public.op_qa_manifest_verifications(id),
 manifest_hash text not null,authorised_by uuid not null references auth.users(id),
 decision_note text not null,authorised_at timestamptz not null default now(),unique(project_id,submission_id));
alter table public.op_qa_engineering_reviews enable row level security;
alter table public.op_qa_manifest_verifications enable row level security;
alter table public.op_qa_release_authorisations enable row level security;
revoke all on public.op_qa_engineering_reviews,public.op_qa_manifest_verifications,public.op_qa_release_authorisations from public,anon,authenticated;
grant select on public.op_qa_engineering_reviews,public.op_qa_manifest_verifications,public.op_qa_release_authorisations to authenticated;
create policy qa_eng_read on public.op_qa_engineering_reviews for select to authenticated using
 (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organisation_id=organisation_id and p.is_active=true));
create policy qa_manifest_read on public.op_qa_manifest_verifications for select to authenticated using
 (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organisation_id=organisation_id and p.is_active=true));
create policy qa_release_read on public.op_qa_release_authorisations for select to authenticated using
 (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.organisation_id=organisation_id and p.is_active=true));

create function public.op_qa_delivery_gate(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_org uuid;v_stage text;v_actor uuid:=auth.uid();v_assignment uuid;v_cycle int;v_submission uuid;
 v_revision text;v_files jsonb:='[]'::jsonb;v_hash text;v_count int:=0;v_present int:=0;
 v_review uuid;v_verified uuid;v_authorised uuid;
begin
 select organisation_id,project_stage into v_org,v_stage from public.projects where id=p_project_id;
 if v_org is null then raise exception 'Project not found'; end if;
 if session_user <> 'postgres' and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
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
end $fn$;

create function public.op_qa_engineering_decision(p_project_id uuid,p_submission_id uuid,p_decision text,p_findings text,p_checklist jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_role text;v_org uuid;v_stage text;v_gate jsonb;v_review uuid;
begin
 select organisation_id,project_stage into v_org,v_stage from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin','engineering') or v_stage<>'internal_review'
 then raise exception 'Authorised engineering reviewer in Internal Review required'; end if;
 if p_decision not in ('accepted','correction_required','rejected') or length(btrim(coalesce(p_findings,'')))<12
 then raise exception 'Record a valid engineering decision and findings of at least twelve characters'; end if;
 v_gate:=public.op_qa_delivery_gate(p_project_id);
 if (v_gate->>'submission_id')::uuid is distinct from p_submission_id
 or not coalesce((v_gate->>'storage_complete')::boolean,false)
 then raise exception 'Current delivery or private-file evidence is missing or changed'; end if;
 if p_decision='accepted' and not (
  coalesce((p_checklist->>'scope')::boolean,false) and coalesce((p_checklist->>'completeness')::boolean,false)
  and coalesce((p_checklist->>'revision')::boolean,false) and coalesce((p_checklist->>'quality')::boolean,false)
  and coalesce((p_checklist->>'exceptions')::boolean,false)
 ) then raise exception 'All five engineering checks must be confirmed for acceptance'; end if;
 insert into public.op_qa_engineering_reviews(organisation_id,project_id,assignment_id,submission_id,execution_cycle,revision,
 manifest,manifest_hash,decision,checklist,findings,reviewer_id)
 values(v_org,p_project_id,(v_gate->>'assignment_id')::uuid,p_submission_id,(v_gate->>'execution_cycle')::int,
 coalesce(v_gate->>'revision',''),v_gate->'files',v_gate->>'manifest_hash',p_decision,p_checklist,btrim(p_findings),v_user)
 returning id into v_review;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'engineering.qa_decided',
 jsonb_build_object('review_id',v_review,'submission_id',p_submission_id,'decision',p_decision,'hash',v_gate->>'manifest_hash'));
 if p_decision <> 'accepted' then
 perform public.op_advance_project_stage(p_project_id,'partner_correction',v_user,
 'Engineering decision: '||p_decision||'. '||left(btrim(p_findings),400));
 end if;
 return jsonb_build_object('review_id',v_review,'decision',p_decision);
end $fn$;

create function public.op_qa_verify_manifest(p_project_id uuid,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_role text;v_org uuid;v_stage text;v_gate jsonb;v_id uuid;
begin
 select organisation_id,project_stage into v_org,v_stage from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin','operator','engineering')
 or v_stage<>'internal_review' or p_confirmed is not true
 then raise exception 'Authorised document-controller confirmation required in Internal Review'; end if;
 v_gate:=public.op_qa_delivery_gate(p_project_id);
 if not coalesce((v_gate->>'engineering_accepted')::boolean,false)
 or not coalesce((v_gate->>'storage_complete')::boolean,false)
 then raise exception 'Current-cycle engineering acceptance and complete storage evidence required'; end if;
 insert into public.op_qa_manifest_verifications(organisation_id,project_id,submission_id,review_id,manifest_hash,verified_by)
 values(v_org,p_project_id,(v_gate->>'submission_id')::uuid,(v_gate->>'review_id')::uuid,
 v_gate->>'manifest_hash',v_user) returning id into v_id;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'delivery.manifest_verified',
 jsonb_build_object('verification_id',v_id,'review_id',v_gate->>'review_id','hash',v_gate->>'manifest_hash'));
 return jsonb_build_object('verification_id',v_id,'manifest_hash',v_gate->>'manifest_hash');
end $fn$;

create function public.op_qa_authorise_review_release(p_project_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_role text;v_org uuid;v_stage text;v_gate jsonb;v_id uuid;
begin
 select organisation_id,project_stage into v_org,v_stage from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin') or v_stage<>'ready_for_client_issue'
 then raise exception 'Owner/admin client-review release authority is required'; end if;
 if length(btrim(coalesce(p_note,'')))<12 then raise exception 'Provide a release decision rationale of at least twelve characters'; end if;
 v_gate:=public.op_qa_delivery_gate(p_project_id);
 if not coalesce((v_gate->>'engineering_accepted')::boolean,false)
 or not coalesce((v_gate->>'manifest_verified')::boolean,false)
 then raise exception 'Current engineering acceptance and document manifest verification are required'; end if;
 insert into public.op_qa_release_authorisations(organisation_id,project_id,submission_id,review_id,verification_id,
 manifest_hash,authorised_by,decision_note)
 values(v_org,p_project_id,(v_gate->>'submission_id')::uuid,(v_gate->>'review_id')::uuid,
 (v_gate->>'verification_id')::uuid,v_gate->>'manifest_hash',v_user,btrim(p_note)) returning id into v_id;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'client_review.release_authorised',
 jsonb_build_object('authorisation_id',v_id,'submission_id',v_gate->>'submission_id','externally_issued',false));
 return jsonb_build_object('authorisation_id',v_id,'externally_issued',false);
end $fn$;

revoke execute on function public.op_qa_delivery_gate(uuid) from public,anon;
revoke execute on function public.op_qa_engineering_decision(uuid,uuid,text,text,jsonb) from public,anon;
revoke execute on function public.op_qa_verify_manifest(uuid,boolean) from public,anon;
revoke execute on function public.op_qa_authorise_review_release(uuid,text) from public,anon;
grant execute on function public.op_qa_delivery_gate(uuid) to authenticated,service_role;
grant execute on function public.op_qa_engineering_decision(uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.op_qa_verify_manifest(uuid,boolean) to authenticated;
grant execute on function public.op_qa_authorise_review_release(uuid,text) to authenticated;

do $migrate$
declare v_src text;v_new text;
begin
 select pg_get_functiondef(oid) into v_src from pg_proc
 where proname='op_project_stage_readiness_core' and pronamespace='public'::regnamespace limit 1;
 if v_src is null or position('Approved Technical Review is required.' in v_src)=0
 or position('Approved Document Register is required.' in v_src)=0
 or position('Issued Handover Pack is required before client transmittal.' in v_src)=0 then
 raise exception 'Unrecognised lifecycle gate: migration refused';
 end if;
 v_new:=replace(v_src,
 'if not v_technical_review_ready then v_reasons:=v_reasons||jsonb_build_array(''Approved Technical Review is required.''); end if;',
 'if not coalesce((public.op_qa_delivery_gate(p.id)->>''engineering_accepted'')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array(''Current submission requires an evidenced engineering acceptance.''); end if;');
 v_new:=replace(v_new,
 'if not v_register_ready then v_reasons:=v_reasons||jsonb_build_array(''Approved Document Register is required.''); end if;',
 'if not coalesce((public.op_qa_delivery_gate(p.id)->>''manifest_verified'')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array(''Current submission manifest must be verified after engineering acceptance.''); end if;');
 v_new:=replace(v_new,
 'if not v_handover_issued then v_reasons:=v_reasons||jsonb_build_array(''Issued Handover Pack is required before client transmittal.''); end if;',
 'if not coalesce((public.op_qa_delivery_gate(p.id)->>''release_authorised'')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array(''Client-review release authorisation is required.''); end if; v_reasons:=v_reasons||jsonb_build_array(''Secure watermarked view-only Client Review Package is not yet implemented; external issue remains blocked.'');');
 if v_new=v_src or position('Current submission manifest must be verified' in v_new)=0
 then raise exception 'Lifecycle gate replacement failed'; end if;
 execute v_new;
end $migrate$;
