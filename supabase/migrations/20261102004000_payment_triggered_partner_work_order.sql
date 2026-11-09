-- OPOS isolated QA: issue the commercially selected Execution Partner Work Order
-- immediately after independently verified opening payment + Project 360.
-- Partner acceptance is separate; execution is still gated by mobilisation.
-- No prior acceptance/payment/project evidence is rewritten.

create table if not exists public.partner_work_orders (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  partner_quote_id uuid not null references public.partner_quotes(id),
  scope_document_id uuid not null references public.documents(id),
  reference text not null,
  scope_reference text not null,
  scope_revision_code text,
  partner_price numeric(14,2) not null check(partner_price>0),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  lead_time_days integer check(lead_time_days is null or lead_time_days>0),
  delivery_commitment text,
  commercial_assumptions text,
  exclusions text,
  payment_terms text not null default 'Partner payable only after verified client final payment, partner completion, OP internal QA approval and client final review approval; no advance.',
  no_partner_advance boolean not null default true check(no_partner_advance),
  status text not null default 'issued' check(status='issued'),
  issued_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique (organisation_id,project_id),
  unique (assignment_id),
  unique (organisation_id,reference)
);
create index if not exists idx_op_partner_wo_partner on public.partner_work_orders(organisation_id,partner_id);
alter table public.partner_work_orders enable row level security;
revoke all on public.partner_work_orders from public,anon,authenticated;
grant select,insert on public.partner_work_orders to service_role;
grant select on public.partner_work_orders to authenticated;
create policy op_partner_wo_member_read on public.partner_work_orders
 for select to authenticated using (exists(select 1 from public.profiles p
 where p.id=auth.uid() and p.organisation_id=partner_work_orders.organisation_id and p.is_active));

-- Scope has already been approved and commercially agreed at quotation stage.
-- The separately generated project Statement of Work may be prepared during mobilisation,
-- but MUST be approved before moving to Ready for execution.
create or replace function public.op_guard_project_execution_assignment()
returns trigger language plpgsql set search_path=public as $$
declare
 v_selected uuid;
 v_partner public.partners%rowtype;
 v_scope public.documents%rowtype;
begin
 select pq.partner_id into v_selected from public.projects pr
 join public.quotes q on q.id=pr.quote_id and q.organisation_id=pr.organisation_id
 join public.commercial_reviews cr on cr.id=q.commercial_review_id
 join public.partner_quotes pq on pq.id=cr.partner_quote_id
 where pr.id=new.project_id and pr.organisation_id=new.organisation_id
  and cr.organisation_id=new.organisation_id and cr.status::text='approved'
  and cr.approved_at is not null and pq.status::text='selected'
  and pq.organisation_id=new.organisation_id and pq.lead_id=q.lead_id;
 if v_selected is null then raise exception 'OS_INTEGRITY: No already approved commercial Execution Partner selection exists.'; end if;
 if v_selected is distinct from new.partner_id then raise exception 'Execution Partner must match the one approved before client quotation.'; end if;
 select * into v_partner from public.partners where id=new.partner_id and organisation_id=new.organisation_id;
 if not found or v_partner.status::text<>'approved' or not v_partner.nda_signed then
  raise exception 'Previously selected Execution Partner must remain approved and NDA-ready.';
 end if;
 if new.scope_document_id is null then raise exception 'Approved technical execution scope is required for Work Order issue.'; end if;
 select * into v_scope from public.documents
  where id=new.scope_document_id and organisation_id=new.organisation_id
   and project_id=new.project_id and is_current_revision
   and document_type in ('scope-of-work','statement-of-work')
   and status::text in ('approved','issued','published');
 if not found then raise exception 'Work Order must use the current approved scope inherited from the client quotation.'; end if;
 return new;
end;$$;

-- Even direct service-role inserts must inherit price, partner and scope from
-- the already approved commercial chain; no unsigned substitute or inflated quote.
create or replace function public.op_guard_partner_work_order_issue()
returns trigger language plpgsql set search_path=public as $$
declare
 v_assignment public.project_execution_assignments%rowtype;
 v_quote public.quotes%rowtype;
 v_partner_quote public.partner_quotes%rowtype;
 v_project public.projects%rowtype;
 v_scope public.documents%rowtype;
 v_finance jsonb;
begin
 select * into v_assignment from public.project_execution_assignments where id=new.assignment_id;
 select * into v_project from public.projects where id=new.project_id;
 if v_assignment.id is null or v_project.id is null or
    v_assignment.project_id<>new.project_id or
    v_assignment.organisation_id<>new.organisation_id or
    v_assignment.partner_id<>new.partner_id or
    v_assignment.scope_document_id<>new.scope_document_id or
    v_project.organisation_id<>new.organisation_id or
    v_project.project_stage not in ('mobilisation','ready_for_execution') then
   raise exception 'Work Order must be attached to the controlled financially released assignment.';
 end if;
 select * into v_scope from public.documents where id=new.scope_document_id
   and organisation_id=new.organisation_id and project_id=new.project_id
   and document_type in ('scope-of-work','statement-of-work')
   and status::text in ('approved','issued','published') and is_current_revision;
 if v_scope.id is null or new.scope_reference<>v_scope.reference or
    new.scope_revision_code is distinct from v_scope.revision_code then
   raise exception 'Work Order scope must match the current approved technical scope.';
 end if;
 select * into v_quote from public.quotes where id=v_project.quote_id and organisation_id=new.organisation_id;
 select pq.* into v_partner_quote from public.commercial_reviews cr
  join public.partner_quotes pq on pq.id=cr.partner_quote_id
  where cr.id=v_quote.commercial_review_id and cr.organisation_id=new.organisation_id
   and cr.status::text='approved' and cr.approved_at is not null
   and pq.status::text='selected' and pq.lead_id=v_quote.lead_id
   and pq.organisation_id=new.organisation_id;
 if v_partner_quote.id is null or v_partner_quote.id<>new.partner_quote_id
  or v_partner_quote.partner_id<>new.partner_id
  or v_partner_quote.price<>new.partner_price
  or upper(trim(v_partner_quote.currency::text))<>upper(trim(new.currency))
  or new.reference<>v_project.project_number||'/WO-01' then
   raise exception 'Work Order pricing, currency, partner and reference must inherit the approved commercial position.';
 end if;
 v_finance:=public.op_project_financial_gate(v_project.id);
 if coalesce((v_finance->>'authorised')::boolean,false)=false or v_finance->>'basis'<>'deposit'
  or coalesce((v_finance->>'required')::numeric,0)<=0
  or coalesce((v_finance->>'received')::numeric,0)<(v_finance->>'required')::numeric then
   raise exception 'Verified paid opening deposit is required before issuing the Work Order.';
 end if;
 if new.no_partner_advance is distinct from true then raise exception 'Partner advance is prohibited.'; end if;
 return new;
end;$$;
drop trigger if exists trg_op_guard_partner_work_order_issue on public.partner_work_orders;
create trigger trg_op_guard_partner_work_order_issue
before insert on public.partner_work_orders for each row
execute function public.op_guard_partner_work_order_issue();

-- Issued Work Orders are immutable; changes require a separately controlled revision.
create or replace function public.op_prevent_issued_partner_wo_mutation()
returns trigger language plpgsql set search_path=public as $$
begin
 raise exception 'An issued Work Order is immutable. Record a governed variation instead.';
end;$$;
drop trigger if exists trg_op_prevent_issued_partner_wo_update on public.partner_work_orders;
create trigger trg_op_prevent_issued_partner_wo_update before update or delete
on public.partner_work_orders for each row execute function public.op_prevent_issued_partner_wo_mutation();

-- Record acceptance during Mobilisation, while separately forbidding commencement
-- until the project advances to Ready for execution.
create or replace function public.op_record_partner_work_order_acceptance(
  p_assignment_id uuid,p_session_id uuid,p_accepted_by_name text,p_accepted_by_role text
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_assignment public.project_execution_assignments%rowtype;
  v_session public.partner_execution_sessions%rowtype;
  v_partner public.partners%rowtype;
  v_project public.projects%rowtype;
  v_scope public.documents%rowtype;
  v_finance jsonb;
  v_existing public.partner_work_order_acceptances%rowtype;
  v_id uuid;
  v_time timestamptz;
begin
  if nullif(trim(coalesce(p_accepted_by_name,'')),'') is null or
     length(trim(coalesce(p_accepted_by_name,''))) < 2 or length(trim(p_accepted_by_name))>200 or
     nullif(trim(coalesce(p_accepted_by_role,'')),'') is null or
     length(trim(coalesce(p_accepted_by_role,''))) < 2 or length(trim(p_accepted_by_role))>200 then
    raise exception 'Named and attributable Partner Work Order acceptance is required.';
  end if;
  select * into v_assignment from public.project_execution_assignments where id=p_assignment_id for update;
  if not found then raise exception 'Work Order assignment does not exist.'; end if;
  if v_assignment.execution_state not in ('awaiting_acknowledgement') or v_assignment.released_at is null then
    raise exception 'Work Order must be formally released before Partner acceptance.';
  end if;
  select * into v_session from public.partner_execution_sessions
   where id=p_session_id and assignment_id=v_assignment.id and project_id=v_assignment.project_id
     and partner_id=v_assignment.partner_id and organisation_id=v_assignment.organisation_id
     and recipient_email=v_assignment.partner_contact_email and status in ('invited','opened','active')
     and expires_at>now() for update;
  if not found then raise exception 'Valid and current Partner portal invitation is required.'; end if;
  select * into v_partner from public.partners
    where id=v_assignment.partner_id and organisation_id=v_assignment.organisation_id;
  if not found or v_partner.status::text<>'approved' or not v_partner.nda_signed or
     lower(trim(coalesce(v_partner.email,'')))<>lower(trim(v_session.recipient_email)) then
    raise exception 'Approved NDA-ready Execution Partner identity is required.';
  end if;
  select * into v_project from public.projects
    where id=v_assignment.project_id and organisation_id=v_assignment.organisation_id;
  if not found or v_project.project_stage not in ('mobilisation','ready_for_execution') then
    raise exception 'Work Order acceptance requires a financially released project still in mobilisation or ready-for-execution.';
  end if;
  select * into v_scope from public.documents
    where id=v_assignment.scope_document_id and organisation_id=v_assignment.organisation_id
      and project_id=v_assignment.project_id and document_type in ('scope-of-work','statement-of-work')
      and status::text in ('approved','issued','published') and is_current_revision;
  if not found then raise exception 'Current approved technical execution scope must be attached.'; end if;
  if not exists (select 1 from public.partner_work_orders w
     where w.assignment_id=v_assignment.id and w.project_id=v_project.id
       and w.partner_id=v_partner.id and w.scope_document_id=v_scope.id
       and w.status='issued' and w.issued_at is not null) then
    raise exception 'An immutable issued Work Order is required for formal acceptance.';
  end if;
  v_finance:=public.op_project_financial_gate(v_project.id);
  if coalesce((v_finance->>'authorised')::boolean,false)=false or
     v_finance->>'basis'<>'deposit' or
     coalesce((v_finance->>'required')::numeric,0)<=0 or
     coalesce((v_finance->>'received')::numeric,0)<coalesce((v_finance->>'required')::numeric,0) then
    raise exception 'Verified opening deposit is required for Work Order acceptance.';
  end if;

  select * into v_existing from public.partner_work_order_acceptances
    where assignment_id=v_assignment.id for update;
  if found then
    if v_existing.session_id<>p_session_id or
       v_existing.scope_document_id<>v_scope.id or
       v_existing.accepted_by_name<>trim(p_accepted_by_name) or
       v_existing.accepted_by_role<>trim(p_accepted_by_role) then
      raise exception 'Work Order was already accepted with different controlled evidence.';
    end if;
    return jsonb_build_object('id',v_existing.id,'acceptedAt',v_existing.accepted_at,'alreadyRecorded',true);
  end if;

  insert into public.partner_work_order_acceptances (
    organisation_id,project_id,assignment_id,partner_id,session_id,
    scope_document_id,scope_revision_code,accepted_by_name,accepted_by_role,acceptance_statement
  ) values (
    v_assignment.organisation_id,v_assignment.project_id,v_assignment.id,v_assignment.partner_id,v_session.id,
    v_scope.id,v_scope.revision_code,trim(p_accepted_by_name),trim(p_accepted_by_role),
    'I formally accept the controlled Execution Partner Work Order and approved execution scope on behalf of the named Partner. No execution commences before separately confirmed mobilisation. Client data and IP remain confidential; obligations and any partner payment are governed by the applicable Execution Partner Agreement and controlled Work Order, subject to client final payment and OP/client approval gates.'
  ) returning id,accepted_at into v_id,v_time;

  insert into public.activity_events (
    organisation_id,entity_type,entity_id,user_id,event_type,event_data
  ) values (
    v_assignment.organisation_id,'project',v_project.id,null,'partner_work_order.accepted',
    jsonb_build_object('acceptanceId',v_id,'assignmentId',v_assignment.id,'partnerId',v_partner.id,
      'scopeDocumentId',v_scope.id,'acceptedByName',trim(p_accepted_by_name),
      'acceptedByRole',trim(p_accepted_by_role),'source','verified_partner_execution_session')
  );
  return jsonb_build_object('id',v_id,'acceptedAt',v_time,'alreadyRecorded',false);
end;$$;
