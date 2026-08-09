'use server';

import { createHash, randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUserContext, assertRole } from '@/lib/auth/context';

function siteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://overflow-partner.vercel.app';
  return `${base.startsWith('http') ? base : `https://${base}`}${path}`;
}

export async function generateStep2TestLinkFormAction(formData: FormData) {
  let destination = '/workspace/acquisition';

  try {
    const { supabase, user, profile, organisationId } = await requireUserContext();
    assertRole(profile.role, ['owner', 'admin']);

    const prospectId = String(formData.get('prospect_id') || '');
    if (!prospectId) throw new Error('Prospect ID is required.');

    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('id,status,converted_lead_id')
      .eq('organisation_id', organisationId)
      .eq('id', prospectId)
      .single();

    if (prospectError || !prospect) throw new Error('Prospect not found.');
    if (prospect.converted_lead_id || prospect.status === 'converted') {
      throw new Error('Step 2 is historical because this opportunity is already owned by Case 360.');
    }

    const { data: session, error: sessionError } = await supabase
      .from('intake_sessions')
      .select('id,status')
      .eq('organisation_id', organisationId)
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) throw new Error('Create the technical intake before generating a Step 2 test link.');
    if (['submitted', 'converted', 'cancelled'].includes(String(session.status))) {
      throw new Error('This technical intake can no longer be edited.');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const nextStatus = session.status === 'expired' ? 'invited' : session.status;

    const { error: updateError } = await supabase
      .from('intake_sessions')
      .update({ token_hash: tokenHash, expires_at: expiresAt, status: nextStatus, updated_at: new Date().toISOString() })
      .eq('organisation_id', organisationId)
      .eq('id', session.id);

    if (updateError) throw updateError;

    await supabase.from('activity_events').insert({
      organisation_id: organisationId,
      user_id: user.id,
      entity_type: 'prospect',
      entity_id: prospectId,
      event_type: 'technical_intake_test_link_generated',
      event_data: { intakeSessionId: session.id, expiresAt, actorRole: profile.role },
    });

    const url = siteUrl(`/intake/${token}`);
    revalidatePath(`/workspace/acquisition/${prospectId}`);
    destination = `/workspace/acquisition/${prospectId}?invitation=${encodeURIComponent(url)}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate the Step 2 test link.';
    destination = `/workspace/acquisition?error=${encodeURIComponent(message)}`;
  }

  redirect(destination);
}
