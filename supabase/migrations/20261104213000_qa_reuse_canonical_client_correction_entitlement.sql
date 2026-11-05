-- QA consolidation: existing one-correction entitlement ledger and governed classified review RPC are authoritative.
CREATE OR REPLACE FUNCTION public.op_qa_classify_and_resolve_client_feedback(p_project_id uuid, p_classification text, p_rationale text, p_partner_instruction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 v_user uuid:=auth.uid();v_project public.projects%rowtype;v_role text;
 v_issue public.op_qa_client_review_issues%rowtype;
 v_decision public.op_qa_client_review_decisions%rowtype;
 v_cycle integer;v_class_id uuid;v_change_id uuid;v_result jsonb;v_used integer;
begin
 select * into v_project from public.projects where id=p_project_id for update;
 select role::text into v_role from public.profiles
  where id=v_user and organisation_id=v_project.organisation_id and is_active=true;
 if v_user is null or v_project.id is null or v_role not in ('owner','admin')
    or v_project.project_stage<>'client_review'
 then raise exception 'Authorised OP owner in current Client Review is required';end if;
 select a.execution_cycle into v_cycle from public.project_execution_assignments a
  where a.project_id=p_project_id and a.organisation_id=v_project.organisation_id
    and a.execution_state not in ('closed','cancelled') order by a.created_at desc limit 1;
 if v_cycle is null then raise exception 'Current active Execution Partner assignment is required';end if;
 select * into v_issue from public.op_qa_client_review_issues i
  where i.project_id=p_project_id and i.organisation_id=v_project.organisation_id
    and i.execution_cycle=v_cycle for update;
 if v_issue.id is null then raise exception 'Current cycle has no authenticated protected client review issue';end if;
 select * into v_decision from public.op_qa_client_review_decisions d
  where d.issue_id=v_issue.id for update;
 if v_decision.id is null or v_decision.outcome not in ('changes_requested','rejected')
 then raise exception 'Only an actual externally attested correction or rejection can be classified';end if;
 if exists(select 1 from public.project_client_reviews r where r.project_id=p_project_id
   and r.organisation_id=v_project.organisation_id and r.execution_cycle=v_cycle)
 then raise exception 'This client decision has already been reconciled';end if;
 if exists(select 1 from public.op_qa_client_correction_classifications c
    where c.issue_id=v_issue.id or c.decision_id=v_decision.id)
 then raise exception 'Client feedback was already classified; do not duplicate work or variation';end if;
 if p_classification not in ('included_correction','partner_defect','variation')
 then raise exception 'Choose included correction, partner defect, or commercial variation';end if;
 if length(btrim(coalesce(p_rationale,'')))<25
 then raise exception 'A written scope classification rationale of at least 25 characters is required';end if;
 if p_classification in ('included_correction','partner_defect')
   and length(btrim(coalesce(p_partner_instruction,'')))<25
 then raise exception 'The Execution Partner must receive a clear written corrective instruction';end if;
 if p_classification='included_correction' then
   select count(*) into v_used from public.op_client_correction_entitlements
   where project_id=p_project_id and organisation_id=v_project.organisation_id
   ;
   if v_used>=1 then raise exception 'The single included correction is already used. Evaluate a partner defect or authorised commercial variation.';end if;
 end if;
 insert into public.op_qa_client_correction_classifications(
  organisation_id,project_id,issue_id,decision_id,execution_cycle,classification,
  rationale,partner_instruction,classified_by
 ) values(
  v_project.organisation_id,p_project_id,v_issue.id,v_decision.id,v_cycle,p_classification,
  btrim(p_rationale),
  case when p_classification='variation' then null else btrim(p_partner_instruction) end,
  v_user
 ) returning id into v_class_id;
 if p_classification='variation' then
   -- This is a *proposal*, not a priced or accepted change order. Do not
   -- dispatch it to the partner or silently amend dates, margin or payment.
   insert into public.project_change_requests(
    organisation_id,project_id,change_reference,description,reason,scope_impact,
    programme_impact,commercial_impact,currency,status,requested_by
   ) values(
    v_project.organisation_id,p_project_id,
    'QA-VAR-'||replace(v_class_id::text,'-',''),
    coalesce(nullif(btrim(v_decision.comments),''),'Client requested new scope during controlled review'),
    btrim(p_rationale),'New scope / variation proposed; not included in approved Work Order',
    'No programme change approved',null,'GBP','proposed',v_user
   ) returning id into v_change_id;
   update public.op_qa_client_correction_classifications
    set change_request_id=v_change_id where id=v_class_id;
   insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
    values(v_project.organisation_id,'project',p_project_id,v_user,'client_review.variation_proposed',
    jsonb_build_object('clientDecisionId',v_decision.id,'classificationId',v_class_id,
      'changeRequestId',v_change_id,'cycle',v_cycle,'partnerInstructed',false));
   return jsonb_build_object('classification',p_classification,'classificationId',v_class_id,
      'changeRequestId',v_change_id,'projectStage','client_review',
      'partnerInstructed',false,'variationApprovalRequired',true);
 end if;
 -- The existing canonical client outcome recorder alone creates the governed
 -- client review record, changes the partner submission's status and opens a
 -- fresh execution cycle. Inserting this same-cycle classification is the
 -- additional evidence it requires; the transaction is all-or-nothing.
 v_result:=public.op_record_classified_client_review(
  v_project.organisation_id,v_user,p_project_id,v_decision.outcome,
  'client_portal','QA-PORTAL/'||v_decision.id::text,v_decision.comments,
  'in_scope_correction',p_classification='partner_defect'
 );
 if v_result->>'projectStage'<>'partner_correction'
 then raise exception 'Governed correction was not opened; classification rolled back';end if;
 insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,event_data)
 values(v_project.organisation_id,'project',p_project_id,v_user,'client_review.partner_correction_classified',
  jsonb_build_object('clientDecisionId',v_decision.id,'classificationId',v_class_id,
    'executionCycleFrom',v_cycle,'classification',p_classification,'instructionPrepared',true));
 return jsonb_build_object('classification',p_classification,'classificationId',v_class_id,
   'projectStage','partner_correction','newExecutionCycle',v_cycle+1,
   'partnerInstructionRecorded',true);
end $function$
;
