begin;

-- Partner correction is already active Partner work. Once the revised delivery
-- is submitted, the next governed hand-off is directly back to OP Internal Review.
create or replace function public.op_advance_project_stage(
  p_project_id uuid,
  p_target_stage text,
  p_actor_id uuid,
  p_note text default null
) returns public.projects
language plpgsql security definer set search_path=public
as $$
declare
  v_project public.projects;
  v_current_stage text;
  v_allowed boolean:=false;
  v_correction_route boolean:=false;
  v_readiness jsonb;
  v_reason text;
  v_status public.project_status;
  v_assignment public.project_execution_assignments;
  v_ref text;
  v_actor_role text;
begin
  select * into v_project from public.projects where id=p_project_id for update;
  if not found then raise exception 'Project not found.'; end if;

  if p_actor_id is not null then
    if auth.uid() is distinct from p_actor_id then raise exception 'Unauthorised Project transition actor.'; end if;
    select role::text into v_actor_role from public.profiles
    where id=p_actor_id and organisation_id=v_project.organisation_id and is_active=true;
    if v_actor_role is null or v_actor_role not in ('owner','admin','operator','engineering','commercial') then
      raise exception 'Your role is not authorised to change Project lifecycle stage.';
    end if;
  elsif auth.uid() is not null then
    raise exception 'Authenticated Project transitions require an attributable actor.';
  end if;

  v_current_stage:=coalesce(v_project.project_stage,'mobilisation');
  v_allowed:=case v_current_stage
    when 'mobilisation' then p_target_stage='ready_for_execution'
    when 'ready_for_execution' then p_target_stage='in_progress'
    when 'in_progress' then p_target_stage='internal_review'
    when 'internal_review' then p_target_stage in ('partner_correction','ready_for_client_issue')
    when 'partner_correction' then p_target_stage='internal_review'
    when 'ready_for_client_issue' then p_target_stage='issued_to_client'
    when 'issued_to_client' then p_target_stage='client_review'
    when 'client_review' then p_target_stage in ('completion','partner_correction')
    when 'completion' then p_target_stage='closed'
    else false end;
  if not v_allowed then raise exception 'Transition from % to % is not permitted.',v_current_stage,p_target_stage; end if;

  v_correction_route:=v_current_stage in ('internal_review','client_review') and p_target_stage='partner_correction';
  if not v_correction_route then
    v_readiness:=public.op_project_stage_readiness(v_project.id);
    if not coalesce((v_readiness->>'ready')::boolean,false) then
      select string_agg(value,'; ') into v_reason from jsonb_array_elements_text(v_readiness->'reasons') as r(value);
      raise exception 'Current project gate is blocked: %',coalesce(v_reason,'required governed evidence is incomplete.');
    end if;
  end if;

  if v_current_stage='client_review' and p_target_stage='partner_correction' then
    if not exists(
      select 1 from public.project_client_reviews r
      join public.project_execution_assignments a on a.project_id=r.project_id and a.execution_cycle=r.execution_cycle
      where r.project_id=v_project.id and r.outcome in ('changes_requested','rejected')
      order by r.recorded_at desc limit 1
    ) then raise exception 'Client Review correction requires a current-cycle changes-requested or rejected outcome.'; end if;
  end if;

  select * into v_assignment from public.project_execution_assignments
  where project_id=v_project.id and execution_state not in ('closed','cancelled')
  order by created_at desc limit 1 for update;

  if p_target_stage='internal_review' then
    if v_assignment.id is not null then
      update public.partner_delivery_submissions set review_status='under_review'
      where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='technical-review' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'technical-review',v_ref,'Technical Review','draft',1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='document-register' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'document-register',v_ref,'Document Register','draft',1);
    end if;
  end if;

  if p_target_stage='partner_correction' and v_assignment.id is not null then
    update public.partner_delivery_submissions set review_status='changes_requested'
    where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    update public.project_execution_assignments set execution_cycle=execution_cycle+1,execution_state='executing',updated_at=now() where id=v_assignment.id;
  end if;

  if p_target_stage='ready_for_client_issue' then
    if v_assignment.id is not null then
      update public.partner_delivery_submissions set review_status='accepted'
      where id=(select id from public.partner_delivery_submissions where assignment_id=v_assignment.id and execution_cycle=v_assignment.execution_cycle order by submitted_at desc limit 1);
    end if;
    if not exists(select 1 from public.documents where project_id=v_project.id and document_type='handover-pack' and status::text<>'superseded') then
      v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
      insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
      values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'handover-pack',v_ref,'Handover Pack','draft',1);
    end if;
  end if;

  if p_target_stage='completion' and not exists(select 1 from public.documents where project_id=v_project.id and document_type='completion-report' and status::text<>'superseded') then
    v_ref:=public.op_next_reference(v_project.organisation_id,'document',null);
    insert into public.documents(organisation_id,project_id,quote_id,created_by,document_type,reference,title,status,version)
    values(v_project.organisation_id,v_project.id,v_project.quote_id,coalesce(p_actor_id,v_project.created_by),'completion-report',v_ref,'Completion Report','draft',1);
  end if;

  if p_target_stage='closed' and v_assignment.id is not null then
    update public.project_execution_assignments set execution_state='closed',updated_at=now() where id=v_assignment.id;
  end if;

  v_status:=case p_target_stage
    when 'ready_for_execution' then 'planning'::public.project_status
    when 'in_progress' then 'active'::public.project_status
    when 'internal_review' then 'review'::public.project_status
    when 'partner_correction' then 'waiting'::public.project_status
    when 'ready_for_client_issue' then 'review'::public.project_status
    when 'issued_to_client' then 'waiting'::public.project_status
    when 'client_review' then 'waiting'::public.project_status
    when 'completion' then 'completed'::public.project_status
    when 'closed' then 'closed'::public.project_status end;

  perform set_config('op.project_stage_transition','allowed',true);
  update public.projects
  set project_stage=p_target_stage,status=v_status,
      notes=case when nullif(trim(coalesce(p_note,'')),'') is null then notes when notes is null or trim(notes)='' then trim(p_note) else notes||E'\n\nStage note: '||trim(p_note) end,
      updated_at=now()
  where id=v_project.id returning * into v_project;

  insert into public.activity_events(organisation_id,entity_type,entity_id,user_id,event_type,old_value,new_value,event_data)
  values(v_project.organisation_id,'project',v_project.id,p_actor_id,'project.stage_advanced',
    jsonb_build_object('project_stage',v_current_stage),jsonb_build_object('project_stage',p_target_stage,'status',v_status::text),
    jsonb_build_object('note',nullif(trim(coalesce(p_note,'')),''),'canonicalLifecycle',true));
  return v_project;
end $$;

-- Add the revised-delivery evidence gate without changing the mature readiness
-- chain used by every other Project stage.
create or replace function public.op_project_stage_readiness(p_project_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public
as $$
declare
  v_base jsonb; v_stage text; v_reasons jsonb; v_project public.projects;
  v_quote_total numeric:=0; v_invoiced_total numeric:=0; v_invoice_issued boolean:=false;
  v_partner_cost numeric:=0; v_partner_payable_total numeric:=0; v_partner_payable_evidence boolean:=false;
  v_assignment_id uuid; v_cycle integer:=1; v_submission_id uuid; v_file_count integer:=0; v_open_exceptions integer:=0;
begin
  v_base:=public.op_project_stage_readiness_evidence_core(p_project_id);
  v_stage:=coalesce(v_base->>'stage','');
  v_reasons:=coalesce(v_base->'reasons','[]'::jsonb);

  if v_stage='partner_correction' then
    select a.id,a.execution_cycle into v_assignment_id,v_cycle
    from public.project_execution_assignments a
    where a.project_id=p_project_id and a.execution_state not in ('closed','cancelled')
    order by a.created_at desc limit 1;
    if v_assignment_id is null then
      v_reasons:=v_reasons||jsonb_build_array('Active Execution Partner assignment is required for the requested changes.');
    else
      select d.id into v_submission_id from public.partner_delivery_submissions d
      where d.assignment_id=v_assignment_id and d.execution_cycle=v_cycle
      order by d.submitted_at desc limit 1;
      if v_submission_id is null then
        v_reasons:=v_reasons||jsonb_build_array('Revised Partner delivery is required before OP review.');
      else
        select count(*) into v_file_count from public.partner_delivery_submission_files f
        where f.submission_id=v_submission_id and f.assignment_id=v_assignment_id and f.execution_cycle=v_cycle;
        if v_file_count=0 then v_reasons:=v_reasons||jsonb_build_array('Revised Partner delivery must include at least one engineering output file.'); end if;
      end if;
    end if;
    select count(*) into v_open_exceptions from public.partner_execution_exceptions
    where project_id=p_project_id and status in ('open','acknowledged');
    if v_open_exceptions>0 then v_reasons:=v_reasons||jsonb_build_array(v_open_exceptions||' open Execution Partner exception(s) must be resolved.'); end if;
  end if;

  if v_stage='completion' then
    select * into v_project from public.projects where id=p_project_id;
    if found then
      select coalesce(q.total,0) into v_quote_total from public.quotes q where q.id=v_project.quote_id;
      if v_quote_total>0 then
        select coalesce(sum(i.total),0) into v_invoiced_total from public.invoices i where i.organisation_id=v_project.organisation_id and i.project_id=v_project.id and i.status not in ('cancelled','refunded');
        if v_invoiced_total + 0.01 < v_quote_total then v_reasons:=v_reasons||jsonb_build_array('Client billing must cover the accepted Quote before closeout.'); end if;
        select exists(select 1 from public.documents d where d.organisation_id=v_project.organisation_id and d.project_id=v_project.id and d.document_type='invoice' and d.status::text in ('issued','published') and d.is_current_revision=true) into v_invoice_issued;
        if not v_invoice_issued then v_reasons:=v_reasons||jsonb_build_array('Issued controlled Invoice evidence is required before closeout.'); end if;
      end if;
      select coalesce(pq.price,0) into v_partner_cost from public.quotes q join public.commercial_reviews cr on cr.id=q.commercial_review_id join public.partner_quotes pq on pq.id=cr.partner_quote_id where q.id=v_project.quote_id;
      if v_partner_cost>0 then
        select coalesce(sum(pp.total),0),coalesce(bool_or(coalesce(pp.evidence_confirmed,false)),false) into v_partner_payable_total,v_partner_payable_evidence
        from public.partner_payables pp join public.quotes q on q.id=v_project.quote_id join public.commercial_reviews cr on cr.id=q.commercial_review_id
        where pp.organisation_id=v_project.organisation_id and pp.project_id=v_project.id and pp.partner_quote_id=cr.partner_quote_id and pp.status not in ('cancelled','disputed');
        if v_partner_payable_total + 0.01 < v_partner_cost then v_reasons:=v_reasons||jsonb_build_array('Recorded Execution Partner liability must cover the accepted Partner cost before closeout.'); end if;
        if not v_partner_payable_evidence then v_reasons:=v_reasons||jsonb_build_array('Execution Partner payable evidence must be confirmed before closeout.'); end if;
      end if;
    end if;
  end if;

  return v_base || jsonb_build_object(
    'reasons',v_reasons,'ready',jsonb_array_length(v_reasons)=0,
    'acceptedQuoteTotal',v_quote_total,'clientInvoicedTotal',v_invoiced_total,
    'issuedInvoiceEvidence',v_invoice_issued,'acceptedPartnerCost',v_partner_cost,
    'partnerPayableRecordedTotal',v_partner_payable_total,'partnerPayableEvidenceConfirmed',v_partner_payable_evidence
  );
end $$;

-- An unresolved Partner exception must keep the assignment blocked even if a
-- later progress report says On track. Resolving the last exception reopens work.
create or replace function public.op_sync_partner_assignment_exception_state()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare v_open integer:=0; v_project_stage text;
begin
  select count(*) into v_open from public.partner_execution_exceptions
  where assignment_id=new.assignment_id and status in ('open','acknowledged');
  select project_stage into v_project_stage from public.projects where id=new.project_id;
  if v_open>0 then
    update public.project_execution_assignments
    set execution_state='blocked',updated_at=now()
    where id=new.assignment_id and execution_state not in ('delivery_submitted','closed','cancelled');
  elsif v_project_stage in ('ready_for_execution','in_progress','partner_correction') then
    update public.project_execution_assignments
    set execution_state='executing',updated_at=now()
    where id=new.assignment_id and execution_state='blocked';
  end if;
  return new;
end $$;

drop trigger if exists trg_op_sync_partner_assignment_exception_state on public.partner_execution_exceptions;
create trigger trg_op_sync_partner_assignment_exception_state
after insert or update of status on public.partner_execution_exceptions
for each row execute function public.op_sync_partner_assignment_exception_state();

create or replace function public.op_preserve_partner_blocked_assignment()
returns trigger
language plpgsql set search_path=public
as $$
begin
  if new.execution_state='executing' and exists(
    select 1 from public.partner_execution_exceptions e
    where e.assignment_id=new.id and e.status in ('open','acknowledged')
  ) then new.execution_state:='blocked'; end if;
  return new;
end $$;

drop trigger if exists trg_op_preserve_partner_blocked_assignment on public.project_execution_assignments;
create trigger trg_op_preserve_partner_blocked_assignment
before update of execution_state on public.project_execution_assignments
for each row execute function public.op_preserve_partner_blocked_assignment();

revoke all on function public.op_sync_partner_assignment_exception_state() from public,anon,authenticated;
revoke all on function public.op_preserve_partner_blocked_assignment() from public,anon,authenticated;

grant execute on function public.op_sync_partner_assignment_exception_state() to service_role;
grant execute on function public.op_preserve_partner_blocked_assignment() to service_role;

commit;
