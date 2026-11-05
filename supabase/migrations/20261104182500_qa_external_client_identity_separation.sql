-- QA strict external identity: an OP staff login cannot also be the reviewing client.
CREATE OR REPLACE FUNCTION public.op_qa_client_review_position(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user uuid:=auth.uid();v_issue public.op_qa_client_review_issues%rowtype;
 v_project public.projects%rowtype;v_tx public.project_client_transmittals%rowtype;
 v_decision public.op_qa_client_review_decisions%rowtype;v_cycle int;v_active uuid;
begin
 if v_user is null then raise exception 'Sign in to the Client Portal to review engineering work'; end if;
 select * into v_project from public.projects where id=p_project_id;
 if v_project.id is null then raise exception 'Client review is not available'; end if;
 if exists(select 1 from public.profiles pf where pf.id=v_user
    and pf.organisation_id=v_project.organisation_id and pf.is_active=true)
 then raise exception 'OP staff login cannot act as an independent Client Review account';end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
 where a.project_id=p_project_id and a.organisation_id=v_project.organisation_id
 and a.execution_state not in ('closed','cancelled') order by a.created_at desc limit 1;
 select i.* into v_issue from public.op_qa_client_review_issues i
 join public.external_portal_memberships m on m.id=i.membership_id
 join public.leads l on l.id=v_project.lead_id and l.organisation_id=v_project.organisation_id
  and l.company_id=m.company_id
 where i.project_id=p_project_id and i.organisation_id=v_project.organisation_id
 and i.execution_cycle=v_cycle and m.auth_user_id=v_user
 and m.is_active=true and m.portal_kind='client'
 and m.organisation_id=v_project.organisation_id
 order by i.issued_at desc limit 1;
 if v_issue.id is null then raise exception 'No authorised current-cycle client review exists for this account'; end if;
 if v_project.project_stage not in ('issued_to_client','client_review','completion','closed')
 then raise exception 'Review access is no longer available in this project stage'; end if;
 select * into v_tx from public.project_client_transmittals
 where id=v_issue.transmittal_id and organisation_id=v_issue.organisation_id
 and project_id=p_project_id and execution_cycle=v_issue.execution_cycle;
 if v_tx.id is null or v_tx.delivery_method<>'client_portal' then
 raise exception 'Protected client review delivery record is missing'; end if;
 if not exists(select 1 from public.partner_delivery_submissions d
    where d.id=v_issue.submission_id and d.organisation_id=v_issue.organisation_id
      and d.project_id=p_project_id and d.execution_cycle=v_cycle and d.review_status='accepted')
 then raise exception 'The approved engineering submission is no longer current'; end if;
 select * into v_decision from public.op_qa_client_review_decisions d where d.issue_id=v_issue.id;
 return jsonb_build_object('issueId',v_issue.id,'projectId',p_project_id,'projectNumber',v_project.project_number,
  'title',v_project.title,'stage',v_project.project_stage,'revision',v_issue.revision,
  'issuedAt',v_issue.issued_at,'dueAt',v_tx.review_due_at,'reference',v_tx.transmittal_reference,
  'files',v_issue.public_manifest,'decision',v_decision.outcome,'decisionComments',v_decision.comments,
  'decidedAt',v_decision.decided_at,'late',v_tx.review_due_at<now(),
  'canRespond',v_project.project_stage='client_review' and v_decision.id is null);
end $function$
;

CREATE OR REPLACE FUNCTION public.op_qa_issue_protected_client_review(p_project_id uuid, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_user uuid:=auth.uid();v_org uuid;v_lead uuid;v_stage text;v_role text;
 v_gate jsonb;v_member uuid;v_email text;v_company text;v_count int;
 v_cycle int;v_files jsonb;v_ref text;v_tx public.project_client_transmittals%rowtype;
 v_issue uuid;v_open int;
begin
 select organisation_id,lead_id,project_stage into v_org,v_lead,v_stage from public.projects
  where id=p_project_id for update;
 select role::text into v_role from public.profiles where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin') or v_stage<>'ready_for_client_issue'
 then raise exception 'An authorised OP owner in review-package preparation is required'; end if;
 if length(btrim(coalesce(p_note,'')))<18 then
  raise exception 'Provide an issue rationale of at least eighteen characters'; end if;
 select count(*) into v_open from public.partner_execution_exceptions
   where project_id=p_project_id and status in ('open','acknowledged');
 if v_open>0 then raise exception 'Unresolved partner exceptions block external review issue'; end if;
 v_gate:=public.op_qa_delivery_gate(p_project_id);
 if not coalesce((v_gate->>'storage_complete')::boolean,false)
  or not coalesce((v_gate->>'engineering_accepted')::boolean,false)
  or not coalesce((v_gate->>'manifest_verified')::boolean,false)
  or not coalesce((v_gate->>'release_authorised')::boolean,false)
  or nullif(v_gate->>'manifest_hash','') is null
  or (v_gate->>'submission_id') is null
 then raise exception 'Current-cycle technical QA, manifest and owner release-preparation evidence is required'; end if;
 v_cycle:=(v_gate->>'execution_cycle')::int;
 if v_cycle is null or v_cycle<1 then raise exception 'Valid current engineering execution cycle required'; end if;
 if exists(select 1 from public.project_client_transmittals t
    where t.project_id=p_project_id and t.organisation_id=v_org and t.execution_cycle=v_cycle)
 or exists(select 1 from public.op_qa_client_review_issues i
    where i.project_id=p_project_id and i.organisation_id=v_org and i.execution_cycle=v_cycle)
 then raise exception 'A review issue is already recorded for the current execution cycle'; end if;
 select count(*) into v_count
 from public.external_portal_memberships m join public.leads l
 on l.id=v_lead and l.organisation_id=m.organisation_id and l.company_id=m.company_id
 where m.organisation_id=v_org and m.is_active=true and m.portal_kind='client';
 if v_count<>1 then
  raise exception 'Exactly one actively authorised Client Portal recipient is required for this QA rehearsal (found %)',v_count; end if;
 select m.id,u.email,c.name into v_member,v_email,v_company
 from public.external_portal_memberships m join public.leads l
  on l.id=v_lead and l.organisation_id=m.organisation_id and l.company_id=m.company_id
 join public.companies c on c.id=m.company_id and c.organisation_id=v_org
 join auth.users u on u.id=m.auth_user_id
 where m.organisation_id=v_org and m.is_active=true and m.portal_kind='client' limit 1;
 if v_member is null or nullif(v_email,'') is null then
  raise exception 'Verified recipient membership and sign-in email are required'; end if;
 if exists(select 1 from public.profiles pf join public.external_portal_memberships pm
   on pm.auth_user_id=pf.id where pm.id=v_member and pf.organisation_id=v_org
   and pf.is_active=true) then
   raise exception 'Client review requires a separate verified external QA login; the existing recipient is also an OP staff member';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.value->>'id',
   'filename',f.value->>'filename','size',f.value->'size') order by f.value->>'id'),'[]'::jsonb)
 into v_files from jsonb_array_elements(v_gate->'files') f(value)
 where f.value->>'bucket'='partner-delivery' and lower(f.value->>'filename') like '%.pdf';
 if jsonb_array_length(v_files)=0 then raise exception 'No supported approved PDF is available for protected client review'; end if;
 v_ref:='OP-REVIEW-'||replace(p_project_id::text,'-','')||'-C'||lpad(v_cycle::text,2,'0');
 insert into public.project_client_transmittals
   (organisation_id,project_id,execution_cycle,transmittal_reference,recipient_name,recipient_email,
    delivery_method,document_manifest,note,issued_by)
 values(v_org,p_project_id,v_cycle,v_ref,v_company,v_email,'client_portal',v_files,
  'Controlled in-app client review; no email delivered. '||btrim(p_note),v_user)
 returning * into v_tx;
 insert into public.op_qa_client_review_issues
   (organisation_id,project_id,membership_id,transmittal_id,submission_id,execution_cycle,
    revision,manifest_hash,public_manifest,issued_by)
 values(v_org,p_project_id,v_member,v_tx.id,(v_gate->>'submission_id')::uuid,v_cycle,
  coalesce(v_gate->>'revision',''),v_gate->>'manifest_hash',v_files,v_user)
 returning id into v_issue;
 -- Advance only through the canonical lifecycle, after protected issue evidence is stored.
 perform public.op_advance_project_stage(p_project_id,'issued_to_client',v_user,
  'Authenticated in-app review '||v_ref||' issued for current cycle; no email sent');
 perform public.op_advance_project_stage(p_project_id,'client_review',v_user,
  'Protected client review is awaiting an actual authenticated client decision');
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'client_review.protected_issued',
   jsonb_build_object('issueId',v_issue,'transmittalId',v_tx.id,'cycle',v_cycle,
    'submissionId',v_gate->>'submission_id','manifestHash',v_gate->>'manifest_hash','channel','authenticated_client_portal'));
 return jsonb_build_object('issued',true,'issueId',v_issue,'reference',v_ref,'reviewDueAt',v_tx.review_due_at,
 'projectStage','client_review','emailSent',false);
end $function$
;

CREATE OR REPLACE FUNCTION public.op_qa_record_client_review_decision(p_project_id uuid, p_outcome text, p_comments text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_user uuid:=auth.uid();v_project public.projects%rowtype;
 v_issue public.op_qa_client_review_issues%rowtype;v_cycle int;v_id uuid;
begin
 if v_user is null then raise exception 'A signed-in Client Portal account is required'; end if;
 select * into v_project from public.projects where id=p_project_id for update;
 if v_project.id is null or v_project.project_stage<>'client_review'
 then raise exception 'The project is not currently accepting Client Review decisions'; end if;
 if exists(select 1 from public.profiles pf where pf.id=v_user
    and pf.organisation_id=v_project.organisation_id and pf.is_active=true)
 then raise exception 'OP staff account cannot submit a protected client review decision';end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
 where a.project_id=p_project_id and a.organisation_id=v_project.organisation_id
 and a.execution_state not in ('closed','cancelled') order by a.created_at desc limit 1;
 select i.* into v_issue from public.op_qa_client_review_issues i
 join public.external_portal_memberships m on m.id=i.membership_id
 join public.leads l on l.id=v_project.lead_id and l.company_id=m.company_id
   and l.organisation_id=v_project.organisation_id
 where i.project_id=p_project_id and i.organisation_id=v_project.organisation_id
 and i.execution_cycle=v_cycle and m.auth_user_id=v_user
 and m.organisation_id=v_project.organisation_id and m.is_active=true and m.portal_kind='client'
 for update of i;
 if v_issue.id is null then raise exception 'Your Client Portal account has no authorised current review'; end if;
 if not exists(select 1 from public.partner_delivery_submissions s
   where s.id=v_issue.submission_id and s.project_id=p_project_id
   and s.organisation_id=v_issue.organisation_id and s.execution_cycle=v_cycle
   and s.review_status='accepted')
 then raise exception 'Current approved engineering submission is missing or superseded'; end if;
 if p_outcome not in ('accepted','accepted_with_comments','changes_requested','rejected')
 then raise exception 'Select an explicit review decision'; end if;
 if p_outcome<>'accepted' and length(btrim(coalesce(p_comments,'')))<12
 then raise exception 'Please provide at least twelve characters of written review comments'; end if;
 if exists(select 1 from public.op_qa_client_review_decisions d where d.issue_id=v_issue.id)
 then raise exception 'This review already has a recorded decision'; end if;
 insert into public.op_qa_client_review_decisions(organisation_id,project_id,issue_id,decided_by,outcome,comments)
 values(v_project.organisation_id,p_project_id,v_issue.id,v_user,p_outcome,nullif(btrim(coalesce(p_comments,'')),''))
 returning id into v_id;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_project.organisation_id,'project',p_project_id,null,'client_review.client_attested',
 jsonb_build_object('decisionId',v_id,'issueId',v_issue.id,'executionCycle',v_cycle,'outcome',p_outcome,'externalAuthUserId',v_user));
 return jsonb_build_object('decisionId',v_id,'recorded',true,'pendingOpReconciliation',true,
   'projectStage',v_project.project_stage);
end $function$
;
