-- Fail closed when a single auth user has both an active internal profile
-- and an active Client/Partner membership (including pre-policy legacy grants).
-- Purpose-limited self-check; never returns account identities or tenant data.
begin;
create or replace function public.portal_identity_conflict()
returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.role())='authenticated' and exists (
    select 1 from public.external_portal_memberships m
    join public.profiles p on p.id=m.auth_user_id and p.is_active
    where m.auth_user_id=(select auth.uid()) and m.is_active
  );
$$;
revoke all on function public.portal_identity_conflict() from public,anon;
grant execute on function public.portal_identity_conflict() to authenticated,service_role;
commit;
