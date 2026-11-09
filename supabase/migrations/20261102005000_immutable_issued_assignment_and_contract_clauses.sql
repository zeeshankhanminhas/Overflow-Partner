-- Once the approved partner's priced Work Order is issued, its commercial
-- assignment cannot be silently rewritten through legacy forms or a service key.
alter table public.partner_work_orders
 add column if not exists correction_allowance integer not null default 1 check(correction_allowance=1),
 add column if not exists change_control_clause text not null default
 'One in-scope correction cycle is included. Additional scope or changes require a separately approved written change order before execution.',
 add column if not exists ip_confidentiality_clause text not null default
 'Client-provided intellectual property remains the client property. New deliverable ownership and licensing follow the Client Agreement; the Execution Partner must uphold equivalent back-to-back confidentiality, restrictions on disclosure and deliverable rights under the signed Execution Partner Agreement. No direct client contact without OP authorisation.';

create or replace function public.op_freeze_issued_partner_assignment()
returns trigger language plpgsql set search_path=public as $$
begin
  if exists(select 1 from public.partner_work_orders wo
       where wo.assignment_id=old.id and wo.organisation_id=old.organisation_id)
    and (
       new.partner_id is distinct from old.partner_id or
       new.scope_document_id is distinct from old.scope_document_id or
       new.partner_contact_email is distinct from old.partner_contact_email or
       new.partner_contact_name is distinct from old.partner_contact_name or
       new.release_reference is distinct from old.release_reference or
       new.release_notes is distinct from old.release_notes or
       new.planned_start_date is distinct from old.planned_start_date or
       new.committed_due_date is distinct from old.committed_due_date or
       new.reporting_cadence is distinct from old.reporting_cadence or
       (old.released_at is not null and new.released_at is distinct from old.released_at)
    ) then
    raise exception 'Issued Work Order assignment is immutable; use governed variation or scope change control.';
  end if;
  return new;
end;$$;
drop trigger if exists trg_op_freeze_issued_partner_assignment on public.project_execution_assignments;
create trigger trg_op_freeze_issued_partner_assignment
before update of partner_id,scope_document_id,partner_contact_email,
 partner_contact_name,release_reference,release_notes,planned_start_date,
 committed_due_date,reporting_cadence,released_at
on public.project_execution_assignments for each row
execute function public.op_freeze_issued_partner_assignment();
