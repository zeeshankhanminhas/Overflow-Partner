-- Financial integrity hardening for Commercial Control.

-- Defensive trigger implementations for INSERT / UPDATE / DELETE recalculation.
create or replace function public.op_payment_recalculate_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.op_recalculate_invoice(old.invoice_id);
    return old;
  end if;
  perform public.op_recalculate_invoice(new.invoice_id);
  if tg_op = 'UPDATE' and old.invoice_id is distinct from new.invoice_id then
    perform public.op_recalculate_invoice(old.invoice_id);
  end if;
  return new;
end;
$$;

create or replace function public.op_partner_payment_recalculate_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.op_recalculate_partner_payable(old.payable_id);
    return old;
  end if;
  perform public.op_recalculate_partner_payable(new.payable_id);
  if tg_op = 'UPDATE' and old.payable_id is distinct from new.payable_id then
    perform public.op_recalculate_partner_payable(old.payable_id);
  end if;
  return new;
end;
$$;

create or replace function public.op_validate_client_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_existing numeric(14,2);
begin
  select * into v_invoice from public.invoices where id = new.invoice_id;
  if not found then raise exception 'Invoice not found.'; end if;
  if v_invoice.organisation_id <> new.organisation_id then raise exception 'Payment organisation does not match invoice.'; end if;
  if v_invoice.project_id <> new.project_id then raise exception 'Payment project does not match invoice.'; end if;
  if upper(v_invoice.currency) <> upper(new.currency) then raise exception 'Payment currency does not match invoice currency.'; end if;
  if v_invoice.status in ('draft','cancelled','refunded') then raise exception 'Payment cannot be recorded against invoice status %.',v_invoice.status; end if;
  if new.status = 'cleared' then
    select coalesce(sum(amount),0) into v_existing from public.payments
      where invoice_id = new.invoice_id and status = 'cleared' and id <> coalesce(new.id,gen_random_uuid());
    if v_existing + new.amount > v_invoice.total then
      raise exception 'Payment exceeds outstanding invoice balance.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_client_payment on public.payments;
create trigger trg_validate_client_payment
before insert or update on public.payments
for each row execute function public.op_validate_client_payment();

create or replace function public.op_validate_partner_payment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_payable public.partner_payables%rowtype;
  v_existing numeric(14,2);
begin
  select * into v_payable from public.partner_payables where id = new.payable_id;
  if not found then raise exception 'Partner payable not found.'; end if;
  if v_payable.organisation_id <> new.organisation_id then raise exception 'Payment organisation does not match payable.'; end if;
  if v_payable.project_id <> new.project_id then raise exception 'Payment project does not match payable.'; end if;
  if upper(v_payable.currency) <> upper(new.currency) then raise exception 'Payment currency does not match payable currency.'; end if;
  if v_payable.status not in ('approved','scheduled','paid') then raise exception 'Partner payment requires an approved payable.'; end if;
  if new.status = 'cleared' then
    select coalesce(sum(amount),0) into v_existing from public.partner_payments
      where payable_id = new.payable_id and status = 'cleared' and id <> coalesce(new.id,gen_random_uuid());
    if v_existing + new.amount > v_payable.total then
      raise exception 'Payment exceeds outstanding partner payable balance.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_partner_payment on public.partner_payments;
create trigger trg_validate_partner_payment
before insert or update on public.partner_payments
for each row execute function public.op_validate_partner_payment();

create or replace function public.op_validate_partner_payable_approval()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('approved','scheduled','paid') and coalesce(new.evidence_confirmed,false) = false then
    raise exception 'Delivery evidence must be confirmed before partner liability is approved.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_partner_payable_approval on public.partner_payables;
create trigger trg_validate_partner_payable_approval
before insert or update of status,evidence_confirmed on public.partner_payables
for each row execute function public.op_validate_partner_payable_approval();

-- Basic ledger amount integrity.
do $$ begin
  alter table public.invoices add constraint invoices_non_negative_amounts check (subtotal >= 0 and vat >= 0 and total >= 0 and amount_paid >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.partner_payables add constraint partner_payables_non_negative_amounts check (subtotal >= 0 and vat >= 0 and total >= 0 and amount_paid >= 0);
exception when duplicate_object then null; end $$;

-- Fast balance / reconciliation paths.
create index if not exists idx_payments_invoice_status on public.payments (invoice_id,status,paid_at desc);
create index if not exists idx_partner_payments_payable_status on public.partner_payments (payable_id,status,paid_at desc);
create index if not exists idx_billing_milestones_project_sequence on public.billing_milestones (organisation_id,project_id,sequence_no);
