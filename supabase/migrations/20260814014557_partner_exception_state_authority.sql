begin;

alter function public.op_preserve_partner_blocked_assignment() security definer;
alter function public.op_preserve_partner_blocked_assignment() set search_path = public;

revoke all on function public.op_preserve_partner_blocked_assignment() from public, anon, authenticated;
grant execute on function public.op_preserve_partner_blocked_assignment() to service_role;

commit;
