import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, Profile } from '@/types/domain';

export const requireUserContext = cache(async function requireUserContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect('/login');

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('id, organisation_id, full_name, first_name, last_name, email, role, is_active, developer_delete_enabled')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;

  // An external membership always takes priority, even if a stale internal
  // profile accidentally exists: no Controller page, action or internal API may
  // elevate an external user through organisation-wide profile membership.
  const {data:external} = await supabase.rpc('portal_my_workspaces');
  if (Array.isArray(external) && external.length) {
    redirect('/portal/' + (external.some((m:{portal_kind:string})=>m.portal_kind==='client') ? 'client' : 'partner'));
  }
  if (profileError || !profile || !profile.is_active || !profile.organisation_id || profile.role === 'partner') {
    redirect('/login?error=' + encodeURIComponent('This sign-in does not have access to the operations workspace. Use your secure invitation link.'));
  }

  return { supabase, user, profile, organisationId: profile.organisation_id };
});

export function assertRole(role: AppRole, allowed: AppRole[]) {
  if (!allowed.includes(role)) throw new Error('You do not have permission to perform this action.');
}
