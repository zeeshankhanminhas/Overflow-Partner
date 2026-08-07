-- Secure client-facing invoice delivery without exposing the private workspace.

alter table public.invoices
  add column if not exists public_token uuid not null default gen_random_uuid();

create unique index if not exists idx_invoices_public_token
  on public.invoices (public_token);

create or replace function public.op_public_invoice_by_token(p_token uuid)
returns table (
  invoice_number text,
  invoice_type text,
  status text,
  description text,
  subtotal numeric,
  vat_rate numeric,
  vat numeric,
  total numeric,
  amount_paid numeric,
  currency text,
  due_date date,
  issued_at timestamptz,
  project_number text,
  project_title text,
  client_company text,
  client_contact text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.invoice_number,
    i.invoice_type,
    i.status,
    i.description,
    i.subtotal,
    i.vat_rate,
    i.vat,
    i.total,
    i.amount_paid,
    i.currency,
    i.due_date,
    i.issued_at,
    p.project_number,
    p.title,
    l.company_name,
    l.contact_name
  from public.invoices i
  join public.projects p on p.id = i.project_id and p.organisation_id = i.organisation_id
  left join public.leads l on l.id = i.lead_id and l.organisation_id = i.organisation_id
  where i.public_token = p_token
    and i.status not in ('draft','cancelled')
  limit 1;
$$;

revoke all on function public.op_public_invoice_by_token(uuid) from public;
grant execute on function public.op_public_invoice_by_token(uuid) to anon, authenticated;
