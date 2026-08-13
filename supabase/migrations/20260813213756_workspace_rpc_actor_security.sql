begin;

-- Phase A launch security hardening.
--
-- The normal workspace uses the signed-in Supabase session and passes user.id
-- into governed RPCs for attribution.  A caller must not be able to substitute
-- another active organisation member's UUID when invoking a SECURITY DEFINER
-- function directly through PostgREST.
--
-- Service-role / database-internal calls remain possible because they do not
-- run with auth.role() = 'authenticated'.
create or replace function public.op_assert_membership(
  p_organisation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if auth.role() = 'authenticated'
     and auth.uid() is distinct from p_user_id then
    raise exception 'Unauthorised workspace actor.';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
      and organisation_id = p_organisation_id
      and is_active = true
  ) then
    raise exception 'User is not an active member of this organisation.';
  end if;
end;
$$;

-- Membership assertion is an internal authorization primitive, not an API.
-- Canonical SECURITY DEFINER RPCs may call it internally; external clients must
-- not invoke it as a standalone PostgREST endpoint.
revoke all on function public.op_assert_membership(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.op_assert_membership(uuid,uuid)
  to service_role;

-- Trigger functions are implementation machinery.  They still execute through
-- their owning triggers, but are not valid client-facing RPC endpoints.  Lock
-- every OP trigger helper rather than maintaining a fragile hand-written list.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'op\_%' escape '\'
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

commit;
