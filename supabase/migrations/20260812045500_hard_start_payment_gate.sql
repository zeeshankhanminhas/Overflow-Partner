-- Operator Experience Recomposition — Wave 1
-- Hard commercial start gate: positive-value Project execution cannot begin
-- until the required client start payment is actually received/cleared.
--
-- Commercial terms remain the requirement source of truth.
-- Payments remain the settlement source of truth.
-- Project/Execution consume the gate; they do not create a second payment model.

create or replace function public.op_project_financial_gate(p_project_id uuid)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_project public.projects%rowtype;
  v_terms public.commercial_terms%rowtype;
  v_quote_total numeric(14,2) := 0;
  v_required numeric(14,2) := 0;
  v_received numeric(14,2) := 0;
  v_percent numeric(8,2) := 0;
  v_currency text := 'GBP';
  v_authorised boolean := false;
  v_reason text := '';
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then
    return jsonb_build_object('authorised',false,'reason','Project not found.','basis',null,'required',0,'received',0,'quoteTotal',0,'currency','GBP');
  end if;

  if v_project.quote_id is not null then
    select coalesce(q.total,0),coalesce(nullif(trim(q.currency::text),''),'GBP')
      into v_quote_total,v_currency
    from public.quotes q
    where q.id=v_project.quote_id and q.organisation_id=v_project.organisation_id;
  end if;

  select * into v_terms
  from public.commercial_terms
  where organisation_id=v_project.organisation_id and project_id=p_project_id
  order by created_at desc
  limit 1;

  select coalesce(sum(pay.amount),0) into v_received
  from public.payments pay
  join public.invoices inv on inv.id=pay.invoice_id
  where pay.organisation_id=v_project.organisation_id
    and pay.project_id=p_project_id
    and pay.status='cleared'
    and inv.organisation_id=v_project.organisation_id
    and inv.project_id=p_project_id
    and inv.status not in ('draft','cancelled','refunded');

  -- A genuinely zero-value Project has no monetary start requirement.
  if v_quote_total <= 0 then
    return jsonb_build_object(
      'authorised',true,
      'reason','Zero-value Project has no client start-payment requirement.',
      'basis',case when v_terms.id is null then null else v_terms.authorisation_basis end,
      'required',0,
      'received',v_received,
      'quoteTotal',v_quote_total,
      'depositPercent',0,
      'currency',v_currency
    );
  end if;

  if v_terms.id is null then
    return jsonb_build_object(
      'authorised',false,
      'reason','Start-payment terms have not been configured from the accepted commercial position.',
      'basis',null,
      'required',0,
      'received',v_received,
      'quoteTotal',v_quote_total,
      'depositPercent',0,
      'currency',v_currency
    );
  end if;

  v_percent:=coalesce(v_terms.deposit_percent,0);
  if coalesce(v_terms.deposit_required_amount,0)>0 then
    v_required:=v_terms.deposit_required_amount;
  elsif v_percent>0 then
    v_required:=round(v_quote_total * v_percent / 100.0,2);
  else
    v_required:=0;
  end if;

  if v_required<=0 then
    v_authorised:=false;
    v_reason:='Positive-value work requires an explicit start-payment amount or percentage before mobilisation can complete.';
  else
    v_authorised:=v_received + 0.009 >= v_required;
    v_reason:=case when v_authorised
      then 'Required client start payment has been received and cleared.'
      else 'Required client start payment is still outstanding.'
    end;
  end if;

  return jsonb_build_object(
    'authorised',v_authorised,
    'reason',v_reason,
    'basis',v_terms.authorisation_basis,
    'required',v_required,
    'received',v_received,
    'quoteTotal',v_quote_total,
    'depositPercent',v_percent,
    'currency',v_currency,
    'paymentTermsDays',v_terms.payment_terms_days
  );
end;
$function$;

-- Canonical readiness remains op_project_stage_readiness(). The lower-level core
-- historically required an execution assignment during Mobilisation. Under the
-- new lifecycle the assignment is created only after payment + mobilisation,
-- so the canonical wrapper removes that obsolete pre-authorisation reason while
-- preserving all other readiness evidence and closeout controls.
create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_base jsonb;
  v_stage text;
  v_reasons jsonb;
  v_project public.projects;
  v_quote_total numeric:=0;
  v_invoiced_total numeric:=0;
  v_invoice_issued boolean:=false;
  v_partner_cost numeric:=0;
  v_partner_payable_total numeric:=0;
  v_partner_payable_evidence boolean:=false;
begin
  v_base:=public.op_project_stage_readiness_evidence_core(p_project_id);
  v_stage:=coalesce(v_base->>'stage','');
  v_reasons:=coalesce(v_base->'reasons','[]'::jsonb);

  if v_stage='mobilisation' then
    select coalesce(jsonb_agg(
      case
        when r.value like 'Financial authorisation:%' then replace(r.value,'Financial authorisation:','Client start payment:')
        else r.value
      end
    ),'[]'::jsonb)
    into v_reasons
    from jsonb_array_elements_text(v_reasons) r(value)
    where r.value <> 'Execution Partner assignment is required before authorisation.';
  end if;

  if v_stage='completion' then
    select * into v_project from public.projects where id=p_project_id;
    if found then
      select coalesce(q.total,0) into v_quote_total from public.quotes q where q.id=v_project.quote_id;
      if v_quote_total>0 then
        select coalesce(sum(i.total),0) into v_invoiced_total
        from public.invoices i
        where i.organisation_id=v_project.organisation_id and i.project_id=v_project.id and i.status not in ('cancelled','refunded');
        if v_invoiced_total + 0.01 < v_quote_total then
          v_reasons:=v_reasons||jsonb_build_array('Client billing must cover the accepted Quote before closeout.');
        end if;
        select exists(
          select 1 from public.documents d
          where d.organisation_id=v_project.organisation_id and d.project_id=v_project.id
            and d.document_type='invoice' and d.status::text in ('issued','published') and d.is_current_revision=true
        ) into v_invoice_issued;
        if not v_invoice_issued then
          v_reasons:=v_reasons||jsonb_build_array('Issued controlled Invoice evidence is required before closeout.');
        end if;
      end if;

      select coalesce(pq.price,0) into v_partner_cost
      from public.quotes q
      join public.commercial_reviews cr on cr.id=q.commercial_review_id
      join public.partner_quotes pq on pq.id=cr.partner_quote_id
      where q.id=v_project.quote_id;

      if v_partner_cost>0 then
        select coalesce(sum(pp.total),0),coalesce(bool_or(coalesce(pp.evidence_confirmed,false)),false)
        into v_partner_payable_total,v_partner_payable_evidence
        from public.partner_payables pp
        join public.quotes q on q.id=v_project.quote_id
        join public.commercial_reviews cr on cr.id=q.commercial_review_id
        where pp.organisation_id=v_project.organisation_id
          and pp.project_id=v_project.id
          and pp.partner_quote_id=cr.partner_quote_id
          and pp.status not in ('cancelled','disputed');
        if v_partner_payable_total + 0.01 < v_partner_cost then
          v_reasons:=v_reasons||jsonb_build_array('Recorded Execution Partner liability must cover the accepted Partner cost before closeout.');
        end if;
        if not v_partner_payable_evidence then
          v_reasons:=v_reasons||jsonb_build_array('Execution Partner payable evidence must be confirmed before closeout.');
        end if;
      end if;
    end if;
  end if;

  return v_base || jsonb_build_object(
    'reasons',v_reasons,
    'ready',jsonb_array_length(v_reasons)=0,
    'acceptedQuoteTotal',v_quote_total,
    'clientInvoicedTotal',v_invoiced_total,
    'issuedInvoiceEvidence',v_invoice_issued,
    'acceptedPartnerCost',v_partner_cost,
    'partnerPayableRecordedTotal',v_partner_payable_total,
    'partnerPayableEvidenceConfirmed',v_partner_payable_evidence
  );
end;
$function$;

-- Guard the internal execution-assignment record without making it an operator
-- concept. New pre-start assignments and release-state transitions require both
-- Ready for execution and cleared start payment. Existing projects already past
-- commencement remain operable and are not rewritten by this migration.
create or replace function public.op_guard_project_execution_assignment()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_project public.projects;
  v_commercial_partner_id uuid;
  v_partner public.partners;
  v_doc public.documents;
  v_financial jsonb;
  v_requires_start_gate boolean:=false;
begin
  select * into v_project
  from public.projects
  where id=new.project_id and organisation_id=new.organisation_id;
  if not found then raise exception 'OS_INTEGRITY: Project not found for execution release.'; end if;

  select pq.partner_id into v_commercial_partner_id
  from public.quotes q
  join public.commercial_reviews cr on cr.id=q.commercial_review_id
  join public.partner_quotes pq on pq.id=cr.partner_quote_id
  where q.id=v_project.quote_id;
  if v_commercial_partner_id is null then raise exception 'OS_INTEGRITY: Project has no commercially selected Execution Partner lineage.'; end if;
  if new.partner_id is distinct from v_commercial_partner_id then raise exception 'Execution Partner must match the Partner approved in the accepted commercial position.'; end if;

  select * into v_partner from public.partners where id=new.partner_id and organisation_id=new.organisation_id;
  if not found or v_partner.status<>'approved' or not coalesce(v_partner.nda_signed,false) then
    raise exception 'Execution Partner must be approved and NDA-ready.';
  end if;

  if new.scope_document_id is null then raise exception 'An approved controlled execution scope is required before Partner release.'; end if;
  select * into v_doc from public.documents where id=new.scope_document_id and organisation_id=new.organisation_id and project_id=new.project_id;
  if not found or v_doc.document_type not in ('scope-of-work','statement-of-work') or v_doc.status::text not in ('approved','issued','published') or not v_doc.is_current_revision then
    raise exception 'Execution release must link current approved Scope of Work or Statement of Work.';
  end if;

  if tg_op='INSERT' then
    v_requires_start_gate:=true;
  elsif tg_op='UPDATE' then
    v_requires_start_gate:=(old.released_at is null and new.released_at is not null)
      or (old.execution_state='not_released' and new.execution_state='awaiting_acknowledgement');
  end if;

  if v_requires_start_gate then
    if coalesce(v_project.project_stage,'mobilisation') <> 'ready_for_execution' then
      raise exception 'Project must complete payment and mobilisation before Partner release.';
    end if;
    v_financial:=public.op_project_financial_gate(v_project.id);
    if not coalesce((v_financial->>'authorised')::boolean,false) then
      raise exception 'Client start payment gate blocked: %',coalesce(v_financial->>'reason','Required client start payment has not cleared.');
    end if;
  end if;

  return new;
end;
$function$;

-- A Partner access session is security/orchestration machinery. Prevent direct
-- session creation from bypassing the same pre-start commercial gate.
create or replace function public.op_guard_partner_execution_session_start()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_project public.projects;
  v_financial jsonb;
begin
  select * into v_project
  from public.projects
  where id=new.project_id and organisation_id=new.organisation_id;
  if not found then raise exception 'Project not found for Partner access.'; end if;

  if coalesce(v_project.project_stage,'mobilisation') in ('mobilisation','ready_for_execution') then
    if coalesce(v_project.project_stage,'mobilisation') <> 'ready_for_execution' then
      raise exception 'Partner access cannot be issued before Project mobilisation is complete.';
    end if;
    v_financial:=public.op_project_financial_gate(v_project.id);
    if not coalesce((v_financial->>'authorised')::boolean,false) then
      raise exception 'Partner access cannot be issued before the required client start payment has cleared.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_op_guard_partner_execution_session_start on public.partner_execution_sessions;
create trigger trg_op_guard_partner_execution_session_start
before insert on public.partner_execution_sessions
for each row execute function public.op_guard_partner_execution_session_start();

-- Direct declaration inserts and the governed commencement RPC both share this
-- guard so Partner commencement cannot become a payment-gate bypass.
create or replace function public.op_guard_partner_commencement_start_payment()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_project public.projects;
  v_financial jsonb;
begin
  select * into v_project
  from public.projects
  where id=new.project_id and organisation_id=new.organisation_id;
  if not found then raise exception 'Project not found for Partner commencement.'; end if;
  if coalesce(v_project.project_stage,'mobilisation') <> 'ready_for_execution' then
    raise exception 'Partner commencement can only start a Project that is Ready for execution.';
  end if;
  v_financial:=public.op_project_financial_gate(v_project.id);
  if not coalesce((v_financial->>'authorised')::boolean,false) then
    raise exception 'Partner commencement is blocked until the required client start payment has been received and cleared.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_op_guard_partner_commencement_start_payment on public.partner_commencement_declarations;
create trigger trg_op_guard_partner_commencement_start_payment
before insert on public.partner_commencement_declarations
for each row execute function public.op_guard_partner_commencement_start_payment();

create or replace function public.op_record_partner_commencement(
  p_assignment_id uuid,
  p_session_id uuid,
  p_execution_lead_name text,
  p_execution_lead_role text,
  p_planned_commencement_date date,
  p_forecast_delivery_date date,
  p_assumptions text,
  p_submitted_by_name text,
  p_submitted_by_role text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_assignment public.project_execution_assignments;
  v_project public.projects;
  v_financial jsonb;
  v_declaration_id uuid;
  v_submitted_at timestamptz;
begin
  select * into v_assignment
  from public.project_execution_assignments
  where id=p_assignment_id
  for update;

  if v_assignment.id is null then raise exception 'Execution assignment not found.'; end if;
  if v_assignment.execution_state in ('closed','cancelled') then raise exception 'Execution assignment is not active.'; end if;

  select * into v_project from public.projects where id=v_assignment.project_id for update;
  if v_project.id is null then raise exception 'Project not found.'; end if;
  if v_project.project_stage <> 'ready_for_execution' then
    raise exception 'Partner commencement can only start a Project that is Ready for execution.';
  end if;

  v_financial:=public.op_project_financial_gate(v_project.id);
  if not coalesce((v_financial->>'authorised')::boolean,false) then
    raise exception 'Partner commencement is blocked until the required client start payment has been received and cleared.';
  end if;

  if exists(select 1 from public.partner_commencement_declarations where assignment_id=v_assignment.id) then
    raise exception 'A commencement declaration is already recorded for this execution assignment.';
  end if;

  insert into public.partner_commencement_declarations (
    organisation_id,assignment_id,project_id,partner_id,
    execution_lead_name,execution_lead_role,planned_commencement_date,forecast_delivery_date,
    scope_reviewed,inputs_received,capacity_confirmed,no_unresolved_blocker,
    assumptions,declaration_text,submitted_by_name,submitted_by_role
  ) values (
    v_assignment.organisation_id,v_assignment.id,v_assignment.project_id,v_assignment.partner_id,
    trim(p_execution_lead_name),nullif(trim(coalesce(p_execution_lead_role,'')),''),p_planned_commencement_date,p_forecast_delivery_date,
    true,true,true,true,
    nullif(trim(coalesce(p_assumptions,'')),''),
    'We confirm that we reviewed the controlled execution package, received the required inputs, have capacity to proceed, have no unresolved commencement blocker, and are commencing execution against the identified project scope.',
    trim(p_submitted_by_name),nullif(trim(coalesce(p_submitted_by_role,'')),'')
  ) returning id,submitted_at into v_declaration_id,v_submitted_at;

  update public.project_execution_assignments
  set execution_state='executing'
  where id=v_assignment.id;

  if p_session_id is not null then
    update public.partner_execution_sessions set status='active' where id=p_session_id and assignment_id=v_assignment.id;
  end if;

  perform public.op_advance_project_stage(v_assignment.project_id,'in_progress',null,'Execution Partner commencement declaration received.');

  insert into public.activity_events (
    organisation_id,entity_type,entity_id,user_id,event_type,event_data
  ) values (
    v_assignment.organisation_id,'project',v_assignment.project_id,null,'partner_execution.commencement_declared',
    jsonb_build_object(
      'assignmentId',v_assignment.id,
      'partnerId',v_assignment.partner_id,
      'declarationId',v_declaration_id,
      'submittedAt',v_submitted_at,
      'executionLeadName',trim(p_execution_lead_name),
      'forecastDeliveryDate',p_forecast_delivery_date,
      'source','execution_partner',
      'stageControl','ready_for_execution_to_in_progress',
      'startPaymentGate','received_cleared'
    )
  );

  return jsonb_build_object('declarationId',v_declaration_id,'submittedAt',v_submitted_at,'projectStage','in_progress');
end;
$function$;
