-- Read-only, organisation-scoped acceptance status for authenticated Project 360.
-- Acceptance writes remain service-role RPC-only (no client INSERT/UPDATE/DELETE).
grant select on public.partner_work_order_acceptances to authenticated;
create policy op_partner_work_order_acceptance_member_read
on public.partner_work_order_acceptances
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.organisation_id=partner_work_order_acceptances.organisation_id
      and p.is_active=true
  )
);
