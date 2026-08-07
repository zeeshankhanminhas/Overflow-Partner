-- Overflow Partner Business Operating Layers
-- Commercial control, executive intelligence, risk/compliance, enterprise search and productivity foundations.

create table if not exists public.commercial_terms (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid null references public.quotes(id) on delete set null,
  authorisation_basis text not null default 'deposit' check (authorisation_basis in ('deposit','po','credit','manual','none')),
  payment_terms_days integer not null default 30 check (payment_terms_days >= 0),
  deposit_percent numeric(6,2) not null default 0 check (deposit_percent between 0 and 100),
  deposit_required_amount numeric(14,2) not null default 0 check (deposit_required_amount >= 0),
  po_number text null,
  credit_approved boolean not null default false,
  override_reason text null,
  authorised_by uuid null,
  authorised_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, project_id)
);

create table if not exists public.financial_counters (
  organisation_id uuid primary key,
  invoice_seq integer not null default 0,
  payable_seq integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  lead_id uuid null references public.leads(id) on delete set null,
  quote_id uuid null references public.quotes(id) on delete set null,
  invoice_number text not null,
  invoice_type text not null default 'milestone' check (invoice_type in ('deposit','milestone','final','credit_note')),
  status text not null default 'draft' check (status in ('draft','issued','part_paid','paid','overdue','cancelled','refunded')),
  description text null,
  subtotal numeric(14,2) not null default 0,
  vat_rate numeric(6,2) not null default 20,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  due_date date null,
  issued_at timestamptz null,
  paid_at timestamptz null,
  external_reference text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, invoice_number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'GBP',
  payment_method text not null default 'bank_transfer',
  status text not null default 'cleared' check (status in ('pending','cleared','failed','refunded')),
  reference text null,
  paid_at timestamptz not null default now(),
  recorded_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.billing_milestones (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  sequence_no integer not null default 1,
  percentage numeric(6,2) null check (percentage is null or percentage between 0 and 100),
  amount numeric(14,2) not null default 0,
  trigger_stage text null,
  status text not null default 'pending' check (status in ('pending','ready','invoiced','paid','waived')),
  invoice_id uuid null references public.invoices(id) on delete set null,
  due_date date null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_payables (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  project_id uuid not null references public.projects(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  partner_quote_id uuid null references public.partner_quotes(id) on delete set null,
  payable_number text not null,
  invoice_reference text null,
  status text not null default 'received' check (status in ('draft','received','matched','approved','scheduled','paid','disputed','cancelled')),
  description text null,
  subtotal numeric(14,2) not null default 0,
  vat numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  currency text not null default 'GBP',
  due_date date null,
  evidence_confirmed boolean not null default false,
  approved_by uuid null,
  approved_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, payable_number)
);

create table if not exists public.partner_payments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  payable_id uuid not null references public.partner_payables(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'GBP',
  payment_method text not null default 'bank_transfer',
  status text not null default 'cleared' check (status in ('pending','cleared','failed','refunded')),
  reference text null,
  paid_at timestamptz not null default now(),
  recorded_by uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.risk_register (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  entity_type text not null check (entity_type in ('organisation','lead','project','partner','client')),
  entity_id uuid null,
  title text not null,
  category text not null default 'operational' check (category in ('commercial','technical','delivery','financial','client','partner','operational','compliance','security')),
  likelihood integer not null default 1 check (likelihood between 1 and 5),
  impact integer not null default 1 check (impact between 1 and 5),
  status text not null default 'open' check (status in ('open','mitigating','accepted','closed')),
  owner_id uuid null,
  due_date date null,
  mitigation text null,
  residual_score integer null check (residual_score is null or residual_score between 1 and 25),
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.compliance_register (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  entity_type text not null check (entity_type in ('organisation','project','partner','client')),
  entity_id uuid null,
  control_type text not null,
  title text not null,
  status text not null default 'missing' check (status in ('missing','pending','valid','due','expired','waived')),
  effective_date date null,
  expiry_date date null,
  evidence_document_id uuid null references public.documents(id) on delete set null,
  owner_id uuid null,
  notes text null,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  title text not null,
  summary text null,
  body text not null,
  knowledge_type text not null default 'note' check (knowledge_type in ('note','lesson','decision','standard','scope','partner_insight','client_preference')),
  tags text[] not null default '{}',
  source_entity_type text null,
  source_entity_id uuid null,
  is_pinned boolean not null default false,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_pins (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  user_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  label text not null,
  href text not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

create index if not exists idx_commercial_terms_org_project on public.commercial_terms (organisation_id, project_id);
create index if not exists idx_invoices_org_status_due on public.invoices (organisation_id, status, due_date, created_at desc);
create index if not exists idx_invoices_org_project on public.invoices (organisation_id, project_id, created_at desc);
create index if not exists idx_payments_org_project_paid on public.payments (organisation_id, project_id, paid_at desc);
create index if not exists idx_partner_payables_org_status_due on public.partner_payables (organisation_id, status, due_date, created_at desc);
create index if not exists idx_partner_payables_org_project on public.partner_payables (organisation_id, project_id, created_at desc);
create index if not exists idx_partner_payments_org_project_paid on public.partner_payments (organisation_id, project_id, paid_at desc);
create index if not exists idx_risks_org_status_score on public.risk_register (organisation_id, status, ((likelihood * impact)) desc, created_at desc);
create index if not exists idx_risks_org_entity on public.risk_register (organisation_id, entity_type, entity_id);
create index if not exists idx_compliance_org_status_expiry on public.compliance_register (organisation_id, status, expiry_date);
create index if not exists idx_compliance_org_entity on public.compliance_register (organisation_id, entity_type, entity_id);
create index if not exists idx_knowledge_org_updated on public.knowledge_entries (organisation_id, updated_at desc);
create index if not exists idx_knowledge_search on public.knowledge_entries using gin (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body,'')));
create index if not exists idx_pins_user_created on public.workspace_pins (organisation_id, user_id, created_at desc);

-- RLS: each new table is isolated by the organisation attached to the authenticated profile.
do $$
declare
  t text;
begin
  foreach t in array array['commercial_terms','financial_counters','invoices','payments','billing_milestones','partner_payables','partner_payments','risk_register','compliance_register','knowledge_entries','workspace_pins']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_organisation_access', t);
    execute format(
      'create policy %I on public.%I for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.organisation_id = %I.organisation_id)) with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true and p.organisation_id = %I.organisation_id))',
      t || '_organisation_access', t, t, t
    );
  end loop;
end $$;

create or replace function public.op_next_financial_number(p_organisation_id uuid, p_kind text)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_seq integer;
  v_prefix text;
begin
  insert into public.financial_counters(organisation_id) values (p_organisation_id)
  on conflict (organisation_id) do nothing;

  if p_kind = 'invoice' then
    update public.financial_counters
      set invoice_seq = invoice_seq + 1, updated_at = now()
      where organisation_id = p_organisation_id
      returning invoice_seq into v_seq;
    v_prefix := 'OP-INV-';
  elsif p_kind = 'payable' then
    update public.financial_counters
      set payable_seq = payable_seq + 1, updated_at = now()
      where organisation_id = p_organisation_id
      returning payable_seq into v_seq;
    v_prefix := 'OP-PAY-';
  else
    raise exception 'Unsupported financial number kind';
  end if;

  return v_prefix || to_char(current_date,'YYYY') || '-' || lpad(v_seq::text,5,'0');
end;
$$;

create or replace function public.op_project_financial_gate(p_project_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_terms public.commercial_terms%rowtype;
  v_received numeric(14,2) := 0;
  v_authorised boolean := false;
  v_reason text := '';
begin
  select * into v_terms from public.commercial_terms where project_id = p_project_id limit 1;
  if not found then
    return jsonb_build_object('authorised',false,'reason','Commercial terms have not been configured.','basis',null,'required',0,'received',0);
  end if;

  select coalesce(sum(p.amount),0) into v_received
  from public.payments p
  where p.project_id = p_project_id and p.status = 'cleared';

  case v_terms.authorisation_basis
    when 'deposit' then
      v_authorised := v_received >= v_terms.deposit_required_amount;
      v_reason := case when v_authorised then 'Required mobilisation deposit has been received.' else 'Mobilisation deposit is outstanding.' end;
    when 'po' then
      v_authorised := coalesce(length(trim(v_terms.po_number)),0) > 0;
      v_reason := case when v_authorised then 'Customer purchase order is recorded.' else 'Customer purchase order is required.' end;
    when 'credit' then
      v_authorised := v_terms.credit_approved;
      v_reason := case when v_authorised then 'Approved credit terms authorise mobilisation.' else 'Credit approval is required.' end;
    when 'manual' then
      v_authorised := v_terms.authorised_at is not null and coalesce(length(trim(v_terms.override_reason)),0) > 0;
      v_reason := case when v_authorised then 'Manual financial authorisation recorded.' else 'Manual authorisation requires an approver and reason.' end;
    when 'none' then
      v_authorised := v_terms.authorised_at is not null;
      v_reason := case when v_authorised then 'No pre-mobilisation payment condition applies.' else 'Commercial terms require explicit authorisation.' end;
  end case;

  return jsonb_build_object(
    'authorised',v_authorised,
    'reason',v_reason,
    'basis',v_terms.authorisation_basis,
    'required',v_terms.deposit_required_amount,
    'received',v_received,
    'paymentTermsDays',v_terms.payment_terms_days,
    'poNumber',v_terms.po_number
  );
end;
$$;

create or replace function public.op_enforce_financial_mobilisation_gate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_gate jsonb;
begin
  if coalesce(old.project_stage,'mobilisation') = 'mobilisation' and new.project_stage = 'ready_for_execution' then
    v_gate := public.op_project_financial_gate(new.id);
    if coalesce((v_gate->>'authorised')::boolean,false) = false then
      raise exception 'Financial mobilisation gate blocked: %', coalesce(v_gate->>'reason','Commercial authorisation is incomplete.');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_projects_financial_mobilisation_gate on public.projects;
create trigger trg_projects_financial_mobilisation_gate
before update of project_stage on public.projects
for each row execute function public.op_enforce_financial_mobilisation_gate();

create or replace function public.op_recalculate_invoice(p_invoice_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_paid numeric(14,2);
  v_total numeric(14,2);
  v_status text;
begin
  select total,status into v_total,v_status from public.invoices where id = p_invoice_id;
  if not found then return; end if;
  select coalesce(sum(amount),0) into v_paid from public.payments where invoice_id = p_invoice_id and status = 'cleared';
  update public.invoices
  set amount_paid = v_paid,
      status = case
        when status in ('cancelled','refunded','draft') then status
        when v_paid >= total and total > 0 then 'paid'
        when v_paid > 0 then 'part_paid'
        when due_date is not null and due_date < current_date then 'overdue'
        else 'issued'
      end,
      paid_at = case when v_paid >= total and total > 0 then coalesce(paid_at,now()) else null end,
      updated_at = now()
  where id = p_invoice_id;
end;
$$;

create or replace function public.op_payment_recalculate_trigger()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.op_recalculate_invoice(coalesce(new.invoice_id,old.invoice_id));
  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_payments_recalculate on public.payments;
create trigger trg_payments_recalculate after insert or update or delete on public.payments
for each row execute function public.op_payment_recalculate_trigger();

create or replace function public.op_recalculate_partner_payable(p_payable_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_paid numeric(14,2);
  v_total numeric(14,2);
begin
  select total into v_total from public.partner_payables where id = p_payable_id;
  if not found then return; end if;
  select coalesce(sum(amount),0) into v_paid from public.partner_payments where payable_id = p_payable_id and status = 'cleared';
  update public.partner_payables
  set amount_paid = v_paid,
      status = case when status in ('cancelled','disputed','draft','received','matched') then status when v_paid >= total and total > 0 then 'paid' else status end,
      updated_at = now()
  where id = p_payable_id;
end;
$$;

create or replace function public.op_partner_payment_recalculate_trigger()
returns trigger language plpgsql set search_path = public as $$
begin
  perform public.op_recalculate_partner_payable(coalesce(new.payable_id,old.payable_id));
  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_partner_payments_recalculate on public.partner_payments;
create trigger trg_partner_payments_recalculate after insert or update or delete on public.partner_payments
for each row execute function public.op_partner_payment_recalculate_trigger();

create or replace function public.op_executive_snapshot(p_organisation_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
select jsonb_build_object(
  'pipelineValue', coalesce((select sum(total) from public.quotes where organisation_id=p_organisation_id and status::text in ('issued','accepted')),0),
  'acceptedValue', coalesce((select sum(total) from public.quotes where organisation_id=p_organisation_id and status::text='accepted'),0),
  'invoicedValue', coalesce((select sum(total) from public.invoices where organisation_id=p_organisation_id and status not in ('draft','cancelled','refunded')),0),
  'cashCollected', coalesce((select sum(amount) from public.payments where organisation_id=p_organisation_id and status='cleared'),0),
  'receivablesOutstanding', greatest(0,coalesce((select sum(total) from public.invoices where organisation_id=p_organisation_id and status not in ('draft','cancelled','refunded')),0)-coalesce((select sum(amount) from public.payments where organisation_id=p_organisation_id and status='cleared'),0)),
  'partnerCommitted', coalesce((select sum(total) from public.partner_payables where organisation_id=p_organisation_id and status in ('approved','scheduled','paid')),0),
  'partnerPaid', coalesce((select sum(amount) from public.partner_payments where organisation_id=p_organisation_id and status='cleared'),0),
  'forecastGrossMargin', coalesce((select sum(total) from public.quotes where organisation_id=p_organisation_id and status::text='accepted'),0)-coalesce((select sum(total) from public.partner_payables where organisation_id=p_organisation_id and status in ('approved','scheduled','paid')),0),
  'activeProjects', coalesce((select count(*) from public.projects where organisation_id=p_organisation_id and status::text not in ('completed','closed','cancelled')),0),
  'overdueInvoices', coalesce((select count(*) from public.invoices where organisation_id=p_organisation_id and status in ('issued','part_paid','overdue') and due_date < current_date),0),
  'openRisks', coalesce((select count(*) from public.risk_register where organisation_id=p_organisation_id and status in ('open','mitigating')),0),
  'criticalRisks', coalesce((select count(*) from public.risk_register where organisation_id=p_organisation_id and status in ('open','mitigating') and likelihood*impact >= 16),0),
  'complianceExceptions', coalesce((select count(*) from public.compliance_register where organisation_id=p_organisation_id and (status in ('missing','expired') or (expiry_date is not null and expiry_date <= current_date + 30))),0)
);
$$;

create or replace function public.op_global_search(p_organisation_id uuid, p_query text, p_limit integer default 30)
returns table(entity_type text, entity_id uuid, title text, subtitle text, href text, rank numeric)
language sql
stable
security invoker
set search_path = public
as $$
with q as (select trim(coalesce(p_query,'')) term), results (
  entity_type,
  entity_id,
  title,
  subtitle,
  href,
  rank
) as (
  select 'case'::text,l.id,coalesce(l.title,l.company_name),concat_ws(' · ',l.company_name,l.contact_name,l.status::text),'/workspace/leads/'||l.id::text,
    case when lower(coalesce(l.title,'')) like lower((select term from q))||'%' then 3 else 1 end::numeric rank
  from public.leads l,q where l.organisation_id=p_organisation_id and q.term<>'' and (coalesce(l.title,'') ilike '%'||q.term||'%' or coalesce(l.company_name,'') ilike '%'||q.term||'%' or coalesce(l.contact_name,'') ilike '%'||q.term||'%')
  union all
  select 'project',p.id,concat_ws(' · ',p.project_number,p.title),concat_ws(' · ',p.status::text,p.project_stage::text),'/workspace/projects/'||p.id::text,
    case when p.project_number ilike (select term from q)||'%' then 3 else 1 end::numeric
  from public.projects p,q where p.organisation_id=p_organisation_id and q.term<>'' and (p.project_number ilike '%'||q.term||'%' or p.title ilike '%'||q.term||'%')
  union all
  select 'document',d.id,concat_ws(' · ',d.reference,d.title),concat_ws(' · ',d.document_type,d.status::text),'/workspace/documents/'||d.id::text,1::numeric
  from public.documents d,q where d.organisation_id=p_organisation_id and q.term<>'' and (d.reference ilike '%'||q.term||'%' or d.title ilike '%'||q.term||'%' or d.document_type ilike '%'||q.term||'%')
  union all
  select 'partner',p.id,p.company_name,concat_ws(' · ',p.services,p.status::text),'/workspace/partners',1::numeric
  from public.partners p,q where p.organisation_id=p_organisation_id and q.term<>'' and (p.company_name ilike '%'||q.term||'%' or coalesce(p.services,'') ilike '%'||q.term||'%')
  union all
  select 'invoice',i.id,i.invoice_number,concat_ws(' · ',i.status,i.currency||' '||i.total::text),'/workspace/commercial-control?invoice='||i.id::text,2::numeric
  from public.invoices i,q where i.organisation_id=p_organisation_id and q.term<>'' and (i.invoice_number ilike '%'||q.term||'%' or coalesce(i.external_reference,'') ilike '%'||q.term||'%' or coalesce(i.description,'') ilike '%'||q.term||'%')
  union all
  select 'risk',r.id,r.title,concat_ws(' · ',r.category,r.status,'Score '||(r.likelihood*r.impact)::text),'/workspace/risk?risk='||r.id::text,1::numeric
  from public.risk_register r,q where r.organisation_id=p_organisation_id and q.term<>'' and (r.title ilike '%'||q.term||'%' or coalesce(r.mitigation,'') ilike '%'||q.term||'%')
  union all
  select 'knowledge',k.id,k.title,concat_ws(' · ',k.knowledge_type,k.summary),'/workspace/knowledge?entry='||k.id::text,
    greatest(1,ts_rank(to_tsvector('english',coalesce(k.title,'')||' '||coalesce(k.summary,'')||' '||coalesce(k.body,'')),plainto_tsquery('english',q.term))*10)::numeric
  from public.knowledge_entries k,q where k.organisation_id=p_organisation_id and q.term<>'' and (to_tsvector('english',coalesce(k.title,'')||' '||coalesce(k.summary,'')||' '||coalesce(k.body,'')) @@ plainto_tsquery('english',q.term) or k.title ilike '%'||q.term||'%')
)
select * from results order by rank desc,title limit greatest(1,least(coalesce(p_limit,30),100));
$$;