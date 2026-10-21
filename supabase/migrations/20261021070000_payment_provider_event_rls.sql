-- STAGED SECURITY REMEDIATION — verify consumers and deploy after isolated regression.
-- Live OPOS currently has RLS disabled on this legacy payment-event table.
-- Read-only inspection shows anon/authenticated lack direct SELECT/INSERT grants;
-- enabling RLS is defence in depth, not evidence of an existing public leak.
alter table public.quote_payment_provider_events enable row level security;
revoke all on public.quote_payment_provider_events from public,anon,authenticated;
-- Keep the payment reconciliation service working; no permissive client policies.
grant select,insert,update on public.quote_payment_provider_events to service_role;
