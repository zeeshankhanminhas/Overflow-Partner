-- Isolated QA: protected client-review handoff.
-- External access is bound to explicit active client company membership, not email matching.
-- Internal QA approval and manifest are rechecked; issued drawings are watermarked on server.
-- No automatic email or payment state changes; no production promotion.
create table if not exists public.op_qa_client_review_issues(
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id),
 project_id uuid not null references public.projects(id),
 membership_id uuid not null references public.external_portal_memberships(id),
 transmittal_id uuid not null unique references public.project_client_transmittals(id),
 submission_id uuid not null references public.partner_delivery_submissions(id),
 execution_cycle integer not null check(execution_cycle>0),
 revision text not null,
 manifest_hash text not null,
 public_manifest jsonb not null,
 issued_by uuid not null references public.profiles(id),
 issued_at timestamptz not null default now(),
 constraint op_qa_one_protected_issue_per_cycle unique(project_id,execution_cycle),
 constraint op_qa_public_manifest_array check(jsonb_typeof(public_manifest)='array')
);
create index if not exists op_qa_review_issues_membership on public.op_qa_client_review_issues(membership_id,project_id);
alter table public.op_qa_client_review_issues enable row level security;
revoke all on public.op_qa_client_review_issues from public,anon,authenticated;
grant all on public.op_qa_client_review_issues to service_role;

create table if not exists public.op_qa_client_review_decisions(
 id uuid primary key default gen_random_uuid(),
 organisation_id uuid not null references public.organisations(id),
 project_id uuid not null references public.projects(id),
 issue_id uuid not null unique references public.op_qa_client_review_issues(id),
 decided_by uuid not null references auth.users(id),
 outcome text not null check(outcome in ('accepted','accepted_with_comments','changes_requested','rejected')),
 comments text,
 decided_at timestamptz not null default now()
);
alter table public.op_qa_client_review_decisions enable row level security;
revoke all on public.op_qa_client_review_decisions from public,anon,authenticated;
grant all on public.op_qa_client_review_decisions to service_role;

create or replace function public.op_qa_issue_protected_client_review(p_project_id uuid,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
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
end $fn$;

create or replace function public.op_qa_client_review_position(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_issue public.op_qa_client_review_issues%rowtype;
 v_project public.projects%rowtype;v_tx public.project_client_transmittals%rowtype;
 v_decision public.op_qa_client_review_decisions%rowtype;v_cycle int;v_active uuid;
begin
 if v_user is null then raise exception 'Sign in to the Client Portal to review engineering work'; end if;
 select * into v_project from public.projects where id=p_project_id;
 if v_project.id is null then raise exception 'Client review is not available'; end if;
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
end $fn$;

create or replace function public.op_qa_record_client_review_decision(p_project_id uuid,p_outcome text,p_comments text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_project public.projects%rowtype;
 v_issue public.op_qa_client_review_issues%rowtype;v_cycle int;v_id uuid;
begin
 if v_user is null then raise exception 'A signed-in Client Portal account is required'; end if;
 select * into v_project from public.projects where id=p_project_id for update;
 if v_project.id is null or v_project.project_stage<>'client_review'
 then raise exception 'The project is not currently accepting Client Review decisions'; end if;
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
 values(v_project.organisation_id,'project',p_project_id,v_user,'client_review.client_attested',
 jsonb_build_object('decisionId',v_id,'issueId',v_issue.id,'executionCycle',v_cycle,'outcome',p_outcome));
 return jsonb_build_object('decisionId',v_id,'recorded',true,'pendingOpReconciliation',true,
   'projectStage',v_project.project_stage);
end $fn$;

create or replace function public.op_qa_staff_client_review_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_org uuid;v_role text;v_issue public.op_qa_client_review_issues%rowtype;
 v_decision public.op_qa_client_review_decisions%rowtype;v_cycle int;
begin
 select organisation_id into v_org from public.projects where id=p_project_id;
 select role::text into v_role from public.profiles
 where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin','operator','engineering')
 then raise exception 'Authorised OP role required'; end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
 where a.project_id=p_project_id and a.organisation_id=v_org and a.execution_state not in ('closed','cancelled')
 order by a.created_at desc limit 1;
 select * into v_issue from public.op_qa_client_review_issues
 where project_id=p_project_id and organisation_id=v_org and execution_cycle=v_cycle
 order by issued_at desc limit 1;
 if v_issue.id is not null then
   select * into v_decision from public.op_qa_client_review_decisions where issue_id=v_issue.id;
 end if;
 return jsonb_build_object('issued',v_issue.id is not null,'issueId',v_issue.id,
 'revision',v_issue.revision,'decisionId',v_decision.id,'decision',v_decision.outcome,
 'decisionComments',v_decision.comments,'decidedAt',v_decision.decided_at,
 'clientAttestationPending',v_issue.id is not null and v_decision.id is null,
 'opReconciliationRequired',v_decision.id is not null and
 not exists(select 1 from public.project_client_reviews r
  where r.project_id=p_project_id and r.organisation_id=v_org
  and r.execution_cycle=v_cycle and r.evidence_reference='QA-PORTAL/'||v_decision.id::text));
end $fn$;

create or replace function public.op_qa_reconcile_client_review_decision(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare v_user uuid:=auth.uid();v_org uuid;v_stage text;v_role text;
 v_issue public.op_qa_client_review_issues%rowtype;v_decision public.op_qa_client_review_decisions%rowtype;
 v_cycle int;v_result jsonb;
begin
 select organisation_id,project_stage into v_org,v_stage from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles where id=v_user and organisation_id=v_org and is_active=true;
 if v_user is null or v_role not in ('owner','admin','operator','engineering') or v_stage<>'client_review'
 then raise exception 'Authorised OP reviewer in Client Review required'; end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
 where a.project_id=p_project_id and a.organisation_id=v_org and a.execution_state not in ('closed','cancelled')
 order by a.created_at desc limit 1;
 select * into v_issue from public.op_qa_client_review_issues where project_id=p_project_id
 and organisation_id=v_org and execution_cycle=v_cycle;
 if v_issue.id is null then raise exception 'No current-cycle protected client issue exists'; end if;
 select * into v_decision from public.op_qa_client_review_decisions where issue_id=v_issue.id;
 if v_decision.id is null then raise exception 'Client has not yet submitted an authenticated decision'; end if;
 if exists(select 1 from public.project_client_reviews where project_id=p_project_id
 and organisation_id=v_org and execution_cycle=v_cycle)
 then raise exception 'The current-cycle client outcome has already been recorded'; end if;
 v_result:=public.op_record_client_review_outcome_core(
   v_org,v_user,p_project_id,v_decision.outcome,'client_portal',
   'QA-PORTAL/'||v_decision.id::text,v_decision.comments
 );
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_org,'project',p_project_id,v_user,'client_review.external_decision_reconciled',
 jsonb_build_object('clientDecisionId',v_decision.id,'outcome',v_decision.outcome));
 return v_result || jsonb_build_object('reconciled',true,'externalDecisionId',v_decision.id);
end $fn$;


CREATE OR REPLACE FUNCTION public.op_project_stage_readiness_core(p_project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  p public.projects; v_stage text; v_reasons jsonb:='[]'::jsonb;
  v_task_total integer:=0; v_task_open integer:=0;
  v_delivery_total integer:=0; v_delivery_work_open integer:=0; v_delivery_close_open integer:=0;
  v_delivery_internal_block integer:=0; v_delivery_client_block integer:=0; v_open_exceptions integer:=0;
  v_assignment_id uuid; v_assignment_partner_id uuid; v_execution_cycle integer:=1; v_partner_commenced boolean:=false;
  v_commercial_partner_id uuid; v_current_submission_id uuid; v_current_submission_review text;
  v_scope_ready boolean:=false; v_statement_ready boolean:=false; v_technical_review_ready boolean:=false;
  v_register_ready boolean:=false; v_handover_issued boolean:=false; v_completion_issued boolean:=false; v_financial jsonb;
  v_open_receivables integer:=0; v_open_payables integer:=0;
begin
  select * into p from public.projects where id=p_project_id;
  if not found then return jsonb_build_object('ready',false,'stage','unknown','reasons',jsonb_build_array('Project not found.')); end if;
  v_stage:=coalesce(p.project_stage,'mobilisation');

  select count(*),count(*) filter(where status not in ('completed','cancelled')) into v_task_total,v_task_open
  from public.tasks where organisation_id=p.organisation_id and entity_type='project' and entity_id=p.id;
  select count(*),count(*) filter(where status in ('not_started','in_progress','blocked')),
    count(*) filter(where status not in ('complete','cancelled')),
    count(*) filter(where internal_review_status in ('pending','changes_required')),
    count(*) filter(where client_review_status in ('pending','changes_required'))
  into v_delivery_total,v_delivery_work_open,v_delivery_close_open,v_delivery_internal_block,v_delivery_client_block
  from public.project_delivery_items where organisation_id=p.organisation_id and project_id=p.id;
  select count(*) into v_open_exceptions from public.partner_execution_exceptions
  where organisation_id=p.organisation_id and project_id=p.id and status in ('open','acknowledged');

  select a.id,a.partner_id,a.execution_cycle into v_assignment_id,v_assignment_partner_id,v_execution_cycle
  from public.project_execution_assignments a
  where a.organisation_id=p.organisation_id and a.project_id=p.id and a.execution_state not in ('closed','cancelled')
  order by a.created_at desc limit 1;
  select pq.partner_id into v_commercial_partner_id
  from public.quotes q join public.commercial_reviews cr on cr.id=q.commercial_review_id join public.partner_quotes pq on pq.id=cr.partner_quote_id
  where q.id=p.quote_id;
  if v_assignment_id is not null then
    select exists(select 1 from public.partner_commencement_declarations where assignment_id=v_assignment_id) into v_partner_commenced;
    select s.id,s.review_status into v_current_submission_id,v_current_submission_review
    from public.partner_delivery_submissions s where s.assignment_id=v_assignment_id and s.execution_cycle=v_execution_cycle
    order by s.submitted_at desc limit 1;
  end if;

  select exists(select 1 from public.documents where project_id=p.id and document_type='scope-of-work' and status::text in ('approved','issued','published') and is_current_revision=true) into v_scope_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='statement-of-work' and status::text in ('approved','issued','published') and is_current_revision=true) into v_statement_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='technical-review' and status::text in ('approved','issued','published') and is_current_revision=true) into v_technical_review_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='document-register' and status::text in ('approved','issued','published') and is_current_revision=true) into v_register_ready;
  select exists(select 1 from public.documents where project_id=p.id and document_type='handover-pack' and status::text in ('issued','published') and is_current_revision=true) into v_handover_issued;
  select exists(select 1 from public.documents where project_id=p.id and document_type='completion-report' and status::text in ('issued','published') and is_current_revision=true) into v_completion_issued;

  if v_stage='mobilisation' then
    if p.quote_id is null then v_reasons:=v_reasons||jsonb_build_array('Accepted Quote is not linked.'); end if;
    if p.quote_id is not null and not exists(select 1 from public.quote_acceptance_records where organisation_id=p.organisation_id and quote_id=p.quote_id) then v_reasons:=v_reasons||jsonb_build_array('Written client acceptance evidence is required.'); end if;
    if p.project_manager_id is null then v_reasons:=v_reasons||jsonb_build_array('Project manager is not assigned.'); end if;
    if p.start_date is null then v_reasons:=v_reasons||jsonb_build_array('Start date is not recorded.'); end if;
    if p.due_date is null then v_reasons:=v_reasons||jsonb_build_array('Due date is not recorded.'); end if;
    if not v_scope_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Scope of Work is required.'); end if;
    if not v_statement_ready then v_reasons:=v_reasons||jsonb_build_array('Approved Statement of Work is required.'); end if;
    if v_commercial_partner_id is null then v_reasons:=v_reasons||jsonb_build_array('Commercial Execution Partner lineage is missing.');
    elsif v_assignment_id is null then v_reasons:=v_reasons||jsonb_build_array('Execution Partner assignment is required before authorisation.');
    elsif v_assignment_partner_id is distinct from v_commercial_partner_id then v_reasons:=v_reasons||jsonb_build_array('Execution Partner does not match the commercially approved Partner.'); end if;
    v_financial:=public.op_project_financial_gate(p.id);
    if not coalesce((v_financial->>'authorised')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array('Financial authorisation: '||coalesce(v_financial->>'reason','Commercial authorisation is incomplete.')); end if;

  elsif v_stage='ready_for_execution' then
    if not v_scope_ready or not v_statement_ready then v_reasons:=v_reasons||jsonb_build_array('Approved execution scope is required.'); end if;
    if v_assignment_id is null then v_reasons:=v_reasons||jsonb_build_array('Execution Partner assignment is required.');
    elsif not v_partner_commenced then v_reasons:=v_reasons||jsonb_build_array('Execution Partner commencement declaration is required.'); end if;

  elsif v_stage='in_progress' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array(v_open_exceptions||' open Execution Partner exception(s) must be resolved.'); end if;
    if v_delivery_work_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_work_open||' Delivery Control item(s) are still active or blocked.'); end if;
    if v_assignment_id is not null then
      if v_current_submission_id is null or coalesce(v_current_submission_review,'') not in ('submitted','under_review','accepted') then v_reasons:=v_reasons||jsonb_build_array('A current-cycle Execution Partner delivery submission is required before Internal Review.'); end if;
    else
      if v_task_total=0 then v_reasons:=v_reasons||jsonb_build_array('At least one internal delivery activity is required.'); end if;
      if v_task_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_task_open||' internal delivery activity(ies) remain open.'); end if;
    end if;

  elsif v_stage='internal_review' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('Open Execution Partner exceptions must be resolved before client release.'); end if;
    if v_assignment_id is not null and (v_current_submission_id is null or coalesce(v_current_submission_review,'') not in ('submitted','under_review')) then v_reasons:=v_reasons||jsonb_build_array('Current-cycle Partner delivery is not in Internal Review.'); end if;
    if v_delivery_internal_block>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_internal_block||' Delivery Control item(s) still require internal review action.'); end if;
    if not coalesce((public.op_qa_delivery_gate(p.id)->>'engineering_accepted')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array('Current submission requires an evidenced engineering acceptance.'); end if;
    if not coalesce((public.op_qa_delivery_gate(p.id)->>'manifest_verified')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array('Current submission manifest must be verified after engineering acceptance.'); end if;

  elsif v_stage='partner_correction' then
    if v_assignment_id is null then v_reasons:=v_reasons||jsonb_build_array('Active Execution Partner assignment is required for correction.'); end if;

  elsif v_stage='ready_for_client_issue' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('Open Execution Partner exceptions must be resolved before client issue.'); end if;
    if not coalesce((public.op_qa_delivery_gate(p.id)->>'release_authorised')::boolean,false) then v_reasons:=v_reasons||jsonb_build_array('Client-review release authorisation is required.'); end if; if not exists (
      select 1 from public.op_qa_client_review_issues i
      join public.project_client_transmittals t on t.id=i.transmittal_id
       and t.organisation_id=i.organisation_id and t.project_id=i.project_id
       and t.execution_cycle=i.execution_cycle and t.delivery_method='client_portal'
      join public.external_portal_memberships m on m.id=i.membership_id
       and m.organisation_id=i.organisation_id and m.is_active=true and m.portal_kind='client'
      join public.leads l on l.id=p.lead_id and l.company_id=m.company_id
      where i.project_id=p.id and i.organisation_id=p.organisation_id
        and i.execution_cycle=v_execution_cycle
        and i.submission_id=(public.op_qa_delivery_gate(p.id)->>'submission_id')::uuid
        and i.manifest_hash=(public.op_qa_delivery_gate(p.id)->>'manifest_hash')
   ) then
      v_reasons:=v_reasons||jsonb_build_array('An authenticated, current-cycle protected Client Portal review issue is required before advancement.');
   end if;

  elsif v_stage='client_review' then
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('Open execution exceptions must be resolved.'); end if;
    if v_delivery_client_block>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_client_block||' Delivery Control item(s) still require client-review resolution.'); end if;

  elsif v_stage='completion' then
    if not v_completion_issued then v_reasons:=v_reasons||jsonb_build_array('Issued Completion Report is required.'); end if;
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array('All Execution Partner exceptions must be resolved.'); end if;
    if v_delivery_close_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_delivery_close_open||' Delivery Control item(s) remain unresolved.'); end if;
    if v_task_open>0 then v_reasons:=v_reasons||jsonb_build_array(v_task_open||' delivery activity(ies) remain open.'); end if;
    select count(*) into v_open_receivables from public.invoices where organisation_id=p.organisation_id and project_id=p.id and status::text not in ('cancelled','refunded') and coalesce(amount_paid,0)<coalesce(total,0);
    select count(*) into v_open_payables from public.partner_payables where organisation_id=p.organisation_id and project_id=p.id and status::text not in ('cancelled','disputed') and coalesce(amount_paid,0)<coalesce(total,0);
    if v_open_receivables>0 then v_reasons:=v_reasons||jsonb_build_array(v_open_receivables||' client receivable(s) remain outstanding.'); end if;
    if v_open_payables>0 then v_reasons:=v_reasons||jsonb_build_array(v_open_payables||' Partner payable(s) remain outstanding.'); end if;
  end if;

  return jsonb_build_object(
    'ready',jsonb_array_length(v_reasons)=0,'stage',v_stage,'reasons',v_reasons,
    'activityTotal',v_task_total,'activityOpen',v_task_open,
    'deliveryItems',v_delivery_total,'deliveryWorkOpen',v_delivery_work_open,'deliveryCloseOpen',v_delivery_close_open,
    'openPartnerExceptions',v_open_exceptions,'executionMode',case when v_assignment_id is null then 'internal' else 'partner' end,
    'executionCycle',v_execution_cycle,'partnerCommencement',v_partner_commenced,
    'currentPartnerSubmissionId',v_current_submission_id,'currentPartnerSubmissionReview',v_current_submission_review
  );
end $function$;


revoke all on function public.op_qa_issue_protected_client_review(uuid,text) from public,anon;
revoke all on function public.op_qa_client_review_position(uuid) from public,anon;
revoke all on function public.op_qa_record_client_review_decision(uuid,text,text) from public,anon;
revoke all on function public.op_qa_staff_client_review_state(uuid) from public,anon;
revoke all on function public.op_qa_reconcile_client_review_decision(uuid) from public,anon;
grant execute on function public.op_qa_issue_protected_client_review(uuid,text) to authenticated;
grant execute on function public.op_qa_client_review_position(uuid) to authenticated;
grant execute on function public.op_qa_record_client_review_decision(uuid,text,text) to authenticated;
grant execute on function public.op_qa_staff_client_review_state(uuid) to authenticated;
grant execute on function public.op_qa_reconcile_client_review_decision(uuid) to authenticated;
comment on table public.op_qa_client_review_issues is
 'QA-only protected in-app issue, tied to exact current submission, file manifest and active client membership; no email implied.';
comment on table public.op_qa_client_review_decisions is
 'QA-only attributable external client decision; OP reconciles separately to canonical project_client_reviews.';
