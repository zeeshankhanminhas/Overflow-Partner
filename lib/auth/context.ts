import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import {isKnownIsolatedQaPresentationPreview} from '@/lib/qa/isolation';
import type { AppRole, Profile } from '@/types/domain';

export const requireUserContext = cache(async function requireUserContext(returnTo?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect(returnTo === '/opos-next' ? '/login?next=%2Fopos-next' : '/login');

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('id, organisation_id, full_name, first_name, last_name, email, role, is_active, developer_delete_enabled')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;

  if (profileError || !profile || !profile.is_active || !profile.organisation_id) {
    // QA account isolation: an authenticated Client cannot enter OP Operator
    // pages. Offer an explicit account switch instead of crashing the workspace.
    // This changes no membership and grants no Operator access.
    if (isKnownIsolatedQaPresentationPreview()) {
      redirect('/login?next=%2Fopos-next&error=' +
        encodeURIComponent('This browser is signed in without an active OP Operator profile. Switch to your Operator account to open Project 360.'));
    }
    throw new Error('Your account is not connected to an active Overflow Partner organisation profile.');
  }

  return { supabase, user, profile, organisationId: profile.organisation_id };
});

export function assertRole(role: AppRole, allowed: AppRole[]) {
  if (!allowed.includes(role)) throw new Error('You do not have permission to perform this action.');
}
