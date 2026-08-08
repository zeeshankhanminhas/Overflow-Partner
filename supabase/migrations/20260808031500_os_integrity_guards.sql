-- Overflow Partner OS Integrity Guards
-- Future-write enforcement for lifecycle ownership, project transitions,
-- billing, receivables and partner liabilities.

create or replace function public.op_integrity_project_stage_rank(p_stage text)
returns integer
language sql
immutable
as $$
  select case coalesce(p_stage,'mobilisation')
    when 'mobilisation' then 10
    when 'ready_for_execution' then 20
    when 'in_progress' then 30
    when 'internal_review' then 40
    when 'partner_correction' then 45
    when 'ready_for_client_issue' then 50
    when 'issued_to_client' then 60
    when 'client_review' then 70
    when 'completion' then 80
    when 'closed' then 90
    else 0
  end;
$$;

create or replace function public.op_integrity_guard_project_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lead_id is not null and exists (
    select 1 from public.projects p
    where p.organisation_id = new.organisation_id
      and p.lead_id = new.lead_id
      and p.id <> new.id
  ) then
    raise exception 'OS_INTEGRITY: A Project already exists for this Case.' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_project_create on public.projects;
create trigger trg_os_integrity_project_create
before insert or update of lead_id on public.projects
for each row execute function public.op_integrity_guard_project_create();

create or replace function public.op_integrity_guard_intake_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.prospects
  where id = new.prospect_id and organisation_id = new.organisation_id;

  if v_status is null then
    raise exception 'OS_INTEGRITY: Prospect not found.';
  end if;

  if v_status in ('qualified','converted') and new.status in ('invited','opened','in_progress','submitted') then
    raise exception 'OS_INTEGRITY: This Prospect has already progressed beyond Technical Intake.';
  end if;

  if new.status in ('invited','opened','in_progress','submitted') and exists (
    select 1 from public.intake_sessions s
    where s.organisation_id = new.organisation_id
      and s.prospect_id = new.prospect_id
      and s.id <> new.id
      and s.status in ('invited','opened','in_progress','submitted')
  ) then
    raise exception 'OS_INTEGRITY: An active or submitted Technical Intake already exists for this Prospect.' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_intake_session on public.intake_sessions;
create trigger trg_os_integrity_intake_session
before insert or update of status, prospect_id on public.intake_sessions
for each row execute function public.op_integrity_guard_intake_session();

create or replace function public.op_integrity_guard_case_child_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
begin
  v_lead_id := new.lead_id;
  if v_lead_id is not null and exists (
    select 1 from public.projects p
    where p.organisation_id = new.organisation_id
      and p.lead_id = v_lead_id
  ) then
    raise exception 'OS_INTEGRITY: Case is historical because Project 360 owns this opportunity.';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.technical_intakes') is not null then
    execute 'drop trigger if exists trg_os_integrity_technical_intake_insert on public.technical_intakes';
    execute 'create trigger trg_os_integrity_technical_intake_insert before insert on public.technical_intakes for each row execute function public.op_integrity_guard_case_child_insert()';
  end if;
  if to_regclass('public.partner_quotes') is not null then
    execute 'drop trigger if exists trg_os_integrity_partner_quote_insert on public.partner_quotes';
    execute 'create trigger trg_os_integrity_partner_quote_insert before insert on public.partner_quotes for each row execute function public.op_integrity_guard_case_child_insert()';
  end if;
  if to_regclass('public.commercial_reviews') is not null then
    execute 'drop trigger if exists trg_os_integrity_commercial_review_insert on public.commercial_reviews';
    execute 'create trigger trg_os_integrity_commercial_review_insert before insert on public.commercial_reviews for each row execute function public.op_integrity_guard_case_child_insert()';
  end if;
  if to_regclass('public.quotes') is not null then
    execute 'drop trigger if exists trg_os_integrity_quote_insert on public.quotes';
    execute 'create trigger trg_os_integrity_quote_insert before insert on public.quotes for each row execute function public.op_integrity_guard_case_child_insert()';
  end if;
end $$;

create or replace function public.op_integrity_guard_project_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text := coalesce(old.project_stage,'mobilisation');
  v_new text := coalesce(new.project_stage,'mobilisation');
  v_gate jsonb;
  v_readiness jsonb;
begin
  if v_old = v_new then return new; end if;

  if not (
    (v_old='mobilisation' and v_new='ready_for_execution') or
    (v_old='ready_for_execution' and v_new='in_progress') or
    (v_old='in_progress' and v_new='internal_review') or
    (v_old='internal_review' and v_new in ('partner_correction','ready_for_client_issue')) or
    (v_old='partner_correction' and v_new='in_progress') or
    (v_old='ready_for_client_issue' and v_new='issued_to_client') or
    (v_old='issued_to_client' and v_new='client_review') or
    (v_old='client_review' and v_new='completion') or
    (v_old='completion' and v_new='closed')
  ) then
    raise exception 'OS_INTEGRITY: Invalid Project transition % -> %.', v_old, v_new;
  end if;

  if v_new not in ('partner_correction','in_progress') then
    begin
      select to_jsonb(r) into v_readiness from public.op_project_stage_readiness(old.id) r;
      if coalesce((v_readiness->>'ready')::boolean,false) is false then
        raise exception 'OS_INTEGRITY: Current Project gate is not ready for progression.';
      end if;
    exception when undefined_function then
      raise exception 'OS_INTEGRITY: Project readiness function is required before stage progression.';
    end;
  end if;

  if v_old='mobilisation' and v_new='ready_for_execution' then
    if new.project_manager_id is null or new.start_date is null or new.due_date is null then
      raise exception 'OS_INTEGRITY: Project manager, start date and due date are required before execution.';
    end if;
    select to_jsonb(g) into v_gate from public.op_project_financial_gate(old.id) g;
    if coalesce((v_gate->>'authorised')::boolean,false) is false then
      raise exception 'OS_INTEGRITY: Financial mobilisation gate is blocked.';
    end if;
  end if;

  if v_new='closed' then
    if exists (
      select 1 from public.invoices i
      where i.organisation_id=new.organisation_id and i.project_id=new.id
        and i.status not in ('cancelled','refunded')
        and coalesce(i.amount_paid,0) < coalesce(i.total,0)
    ) then raise exception 'OS_INTEGRITY: Project cannot close with outstanding client receivables.'; end if;

    if exists (
      select 1 from public.partner_payables p
      where p.organisation_id=new.organisation_id and p.project_id=new.id
        and p.status not in ('cancelled','disputed')
        and coalesce(p.amount_paid,0) < coalesce(p.total,0)
    ) then raise exception 'OS_INTEGRITY: Project cannot close with outstanding partner liabilities.'; end if;

    if exists (
      select 1 from public.tasks t
      where t.organisation_id=new.organisation_id and t.entity_type='project' and t.entity_id=new.id
        and t.status not in ('completed','cancelled')
    ) then raise exception 'OS_INTEGRITY: Project cannot close with open delivery activities.'; end if;

    if not exists (
      select 1 from public.documents d
      where d.organisation_id=new.organisation_id and d.project_id=new.id
        and d.status in ('issued','published','archived')
    ) then raise exception 'OS_INTEGRITY: Project cannot close without issued controlled evidence.'; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_os_integrity_project_transition on public.projects;
create trigger trg_os_integrity_project_transition
before update of project_stage on public.projects
for each row execute function public.op_integrity_guard_project_transition();

create or replace function public.op_integrity_guard_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_terms public.commercial_terms%rowtype;
  v_rank integer;
  v_tasks integer;
  v_open_tasks integer;
begin
  select * into v_project from public.projects
  where id=new.project_id and organisation_id=new.organisation_id;
  if v_project.id is null then raise exception 'OS_INTEGRITY: Project not found for invoice.'; end if;
  if v_project.status='cancelled' then raise exception 'OS_INTEGRITY: Cancelled Projects cannot be billed.'; end if;

  select * into v_terms from public.commercial_terms
  where project_id=new.project_id and organisation_id=new.organisation_id;
  v_rank := public.op_integrity_project_stage_rank(v_project.project_stage);

  if new.invoice_type='deposit' then
    if coalesce(v_terms.authorisation_basis,'') <> 'deposit'
       or (coalesce(v_terms.deposit_required_amount,0)<=0 and coalesce(v_terms.deposit_percent,0)<=0)
       or v_rank > 20 then
      raise exception 'OS_INTEGRITY: Deposit invoice is not permitted by current commercial terms/stage.';
    end if;
  elsif new.invoice_type='milestone' then
    if v_rank < 40 then raise exception 'OS_INTEGRITY: Milestone invoice is not permitted before governed delivery reaches review.'; end if;
    select count(*), count(*) filter (where status not in ('completed','cancelled'))
      into v_tasks, v_open_tasks
      from public.tasks where organisation_id=new.organisation_id and entity_type='project' and entity_id=new.project_id;
    if v_tasks=0 or v_open_tasks>0 then raise exception 'OS_INTEGRITY: Milestone invoice requires an evidenced completed delivery milestone.'; end if;
  elsif new.invoice_type='final' then
    if v_rank < 80 then raise exception 'OS_INTEGRITY: Final invoice is not permitted before Project Completion.'; end if;
  elsif new.invoice_type='credit_note' then
    if not exists (
      select 1 from public.invoices i where i.organisation_id=new.organisation_id and i.project_id=new.project_id
      and i.id<>new.id and i.status not in ('draft','cancelled','refunded')
    ) then raise exception 'OS_INTEGRITY: Credit note requires an existing issued or settled invoice.'; end if;
  else
    raise exception 'OS_INTEGRITY: Unsupported invoice type %.', new.invoice_type;
  end if;

  if tg_op='UPDATE' and new.status='issued' and old.status is distinct from 'issued' then
    if old.status <> 'draft' then raise exception 'OS_INTEGRITY: Only a Draft invoice can be issued.'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_invoice on public.invoices;
create trigger trg_os_integrity_invoice
before insert or update of status, invoice_type, project_id on public.invoices
for each row execute function public.op_integrity_guard_invoice();

create or replace function public.op_integrity_guard_client_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_paid numeric;
begin
  select * into v_invoice from public.invoices where id=new.invoice_id and organisation_id=new.organisation_id for update;
  if v_invoice.id is null then raise exception 'OS_INTEGRITY: Invoice not found.'; end if;
  if v_invoice.status in ('draft','cancelled','refunded') then raise exception 'OS_INTEGRITY: Payment cannot be applied to this invoice state.'; end if;
  if coalesce(new.amount,0)<=0 then raise exception 'OS_INTEGRITY: Payment amount must be greater than zero.'; end if;
  select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id=new.invoice_id and status='cleared';
  if v_paid + new.amount > coalesce(v_invoice.total,0) then raise exception 'OS_INTEGRITY: Payment exceeds outstanding invoice balance.'; end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_client_payment on public.payments;
create trigger trg_os_integrity_client_payment
before insert on public.payments
for each row execute function public.op_integrity_guard_client_payment();

create or replace function public.op_integrity_guard_partner_payable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_rank integer;
begin
  select * into v_project from public.projects where id=new.project_id and organisation_id=new.organisation_id;
  if v_project.id is null then raise exception 'OS_INTEGRITY: Project not found for partner payable.'; end if;
  v_rank:=public.op_integrity_project_stage_rank(v_project.project_stage);
  if v_rank < 40 then raise exception 'OS_INTEGRITY: Partner payable cannot be recorded before governed delivery evidence exists.'; end if;
  if not exists (
    select 1 from public.tasks t where t.organisation_id=new.organisation_id and t.entity_type='project' and t.entity_id=new.project_id and t.status='completed'
  ) and not exists (
    select 1 from public.documents d where d.organisation_id=new.organisation_id and d.project_id=new.project_id and d.status in ('approved','issued','published','archived')
  ) then raise exception 'OS_INTEGRITY: Partner payable requires completed delivery activity or approved controlled evidence.'; end if;
  if tg_op='UPDATE' and new.status='approved' and old.status is distinct from 'approved' and coalesce(new.evidence_confirmed,false)=false then
    raise exception 'OS_INTEGRITY: Delivery evidence must be confirmed before payable approval.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_partner_payable on public.partner_payables;
create trigger trg_os_integrity_partner_payable
before insert or update of status, project_id, evidence_confirmed on public.partner_payables
for each row execute function public.op_integrity_guard_partner_payable();

create or replace function public.op_integrity_guard_partner_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payable public.partner_payables%rowtype;
  v_paid numeric;
begin
  select * into v_payable from public.partner_payables where id=new.payable_id and organisation_id=new.organisation_id for update;
  if v_payable.id is null then raise exception 'OS_INTEGRITY: Partner payable not found.'; end if;
  if v_payable.status not in ('approved','scheduled') then raise exception 'OS_INTEGRITY: Partner payment requires an approved payable.'; end if;
  if coalesce(new.amount,0)<=0 then raise exception 'OS_INTEGRITY: Partner payment amount must be greater than zero.'; end if;
  select coalesce(sum(amount),0) into v_paid from public.partner_payments where payable_id=new.payable_id and status='cleared';
  if v_paid + new.amount > coalesce(v_payable.total,0) then raise exception 'OS_INTEGRITY: Partner payment exceeds outstanding payable balance.'; end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_partner_payment on public.partner_payments;
create trigger trg_os_integrity_partner_payment
before insert on public.partner_payments
for each row execute function public.op_integrity_guard_partner_payment();

-- Controlled documents must not be manually promoted by INSERT.
create or replace function public.op_integrity_guard_document_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('draft') then
    raise exception 'OS_INTEGRITY: New controlled documents must begin in Draft.';
  end if;
  if new.project_id is not null and new.lead_id is not null then
    -- A Project document may retain lead lineage in legacy data, but new ownership is Project.
    -- Do not reject generated Project evidence solely for lineage columns.
    null;
  elsif new.project_id is null and new.lead_id is not null and exists (
    select 1 from public.projects p where p.organisation_id=new.organisation_id and p.lead_id=new.lead_id
  ) then
    raise exception 'OS_INTEGRITY: Case is historical; new evidence must be created in Project 360.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_os_integrity_document_insert on public.documents;
create trigger trg_os_integrity_document_insert
before insert on public.documents
for each row execute function public.op_integrity_guard_document_insert();
