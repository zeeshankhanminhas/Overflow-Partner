-- QA-FIRST: formal execution-partner Work Order acceptance.
-- No existing projects, accepted quotes, payment receipts, or partner identities are rewritten.
-- Production application requires review before applying this migration outside isolated QA.

create table if not exists public.partner_work_order_acceptances (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  assignment_id uuid not null references public.project_execution_assignments(id) on delete cascade,
  partner_id uuid not null references public.partners(id),
  session_id uuid not null references public.partner_execution_sessions(id),
  scope_document_id uuid not null references public.documents(id),
  scope_revision_code text,
  accepted_by_name text not null check (length(trim(accepted_by_name)) between 2 and 200),
  accepted_by_role text not null check (length(trim(accepted_by_role)) between 2 and 200),
  acceptance_statement text not null,
  accepted_at timestamptz not null default now(),
  unique(assignment_id)
);
create index if not exists idx_op_wo_acceptances_project on public.partner_work_order_acceptances(organisation_id,project_id);

alter table public.partner_work_order_acceptances enable row level security;
revoke all on table public.partner_work_order_acceptances from public,anon,authenticated;
grant select,insert on table public.partner_work_order_acceptances to service_role;

-- Only the server's validated signed partner-session action can call this RPC.
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
  if not found or v_project.project_stage<>'ready_for_execution' then
    raise exception 'Governed mobilisation must reach Ready for execution before Work Order acceptance.';
  end if;
  select * into v_scope from public.documents
    where id=v_assignment.scope_document_id and organisation_id=v_assignment.organisation_id
      and project_id=v_assignment.project_id and document_type='statement-of-work'
      and status::text in ('approved','issued','published') and is_current_revision;
  if not found then raise exception 'Current approved Statement of Work must be attached.'; end if;
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
    'I formally accept the controlled Execution Partner Work Order and linked Statement of Work on behalf of the named Partner. No execution commences before separately confirmed mobilisation. Client data and IP remain confidential; obligations and any partner payment are governed by the applicable Execution Partner Agreement and controlled Work Order, subject to client final payment and OP/client approval gates.'
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
revoke all on function public.op_record_partner_work_order_acceptance(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.op_record_partner_work_order_acceptance(uuid,uuid,text,text) to service_role;

-- Server and database are both authoritative: a forged API request, or a direct
-- service-role commencement RPC, cannot start before explicit Work Order acceptance.
create or replace function public.op_require_work_order_acceptance_before_commencement()
 returns trigger language plpgsql set search_path=public as $$
begin
  if not exists (
    select 1 from public.partner_work_order_acceptances a
    join public.project_execution_assignments x on x.id=a.assignment_id
    where a.assignment_id=new.assignment_id and a.project_id=new.project_id
      and a.partner_id=new.partner_id and a.organisation_id=new.organisation_id
      and a.scope_document_id=x.scope_document_id
  ) then
    raise exception 'Partner commencement is blocked until the issued Work Order is formally accepted.';
  end if;
  return new;
end;$$;
drop trigger if exists trg_op_wo_acceptance_before_commencement on public.partner_commencement_declarations;
create trigger trg_op_wo_acceptance_before_commencement
before insert on public.partner_commencement_declarations
for each row execute function public.op_require_work_order_acceptance_before_commencement();

create or replace function public.op_require_work_order_acceptance_before_execution_stage()
 returns trigger language plpgsql set search_path=public as $$
begin
  if old.project_stage='ready_for_execution' and new.project_stage='in_progress' and
     not exists (
       select 1 from public.project_execution_assignments x
       join public.partner_work_order_acceptances a on a.assignment_id=x.id
       where x.project_id=new.id and x.organisation_id=new.organisation_id
         and x.partner_id=a.partner_id and x.scope_document_id=a.scope_document_id
     ) then
    raise exception 'Execution stage requires a formally accepted Execution Partner Work Order.';
  end if;
  return new;
end;$$;
drop trigger if exists trg_op_wo_acceptance_before_execution_stage on public.projects;
create trigger trg_op_wo_acceptance_before_execution_stage
before update of project_stage on public.projects
for each row execute function public.op_require_work_order_acceptance_before_execution_stage();
