import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { AppRole, Profile } from '@/types/domain';

export async function requireUserContext() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) redirect('/login');

  const { data, error: profileError } = await supabase
    .from('profiles')
    .select('id, organisation_id, full_name, first_name, last_name, email, role, is_active')
    .eq('id', user.id)
    .single();

  const profile = data as Profile | null;

  if (profileError || !profile || !profile.is_active || !profile.organisation_id) {
    throw new Error('Your account is not connected to an active Overflow Partner organisation profile.');
  }

  return { supabase, user, profile, organisationId: profile.organisation_id };
}

export function assertRole(role: AppRole, allowed: AppRole[]) {
  if (!allowed.includes(role)) throw new Error('You do not have permission to perform this action.');
}
