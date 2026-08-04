import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderStep2Invitation } from '../_shared/email/step-2-invitation.ts';
import { sendWithResend } from '../_shared/email/send-resend.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'Method not allowed.' }, 405);

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const orchestrationSecret = Deno.env.get('STEP2_ORCHESTRATION_SECRET');
    const suppliedSecret = request.headers.get('x-internal-secret') || '';

    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error('Supabase function credentials are not configured.');
    }
    if (!orchestrationSecret) {
      throw new Error('STEP2_ORCHESTRATION_SECRET is not configured.');
    }
    if (!suppliedSecret || !constantTimeEqual(suppliedSecret, orchestrationSecret)) {
      return json({ success: false, error: 'Unauthorized.' }, 401);
    }

    const payload = await request.json() as {
      prospectId?: string;
      organisationId?: string;
      actorUserId?: string;
      recipientEmail?: string;
      recipientName?: string;
      companyName?: string;
      projectType?: string;
      publicBaseUrl?: string;
    };
    const required = ['prospectId','organisationId','actorUserId','recipientEmail','recipientName','companyName','projectType','publicBaseUrl'] as const;
    for (const key of required) {
      if (!payload[key]) return json({ success: false, error: `${key} is required.` }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: prospect, error: prospectError } = await supabase.from('prospects')
      .select('id, organisation_id, status').eq('id', payload.prospectId).eq('organisation_id', payload.organisationId).single();
    if (prospectError || !prospect) return json({ success: false, error: 'Prospect not found.' }, 404);

    const { data: existing } = await supabase.from('intake_sessions')
      .select('id, status, email_status, expires_at').eq('organisation_id', payload.organisationId)
      .eq('prospect_id', payload.prospectId).not('status', 'in', '(converted,expired,cancelled)').maybeSingle();
    if (existing) {
      return json({ success: true, reused: true, sessionId: existing.id, emailStatus: existing.email_status, status: existing.status });
    }

    const rawToken = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const tokenBytes = new TextEncoder().encode(rawToken);
    const digest = await crypto.subtle.digest('SHA-256', tokenBytes);
    const tokenHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: session, error: sessionError } = await supabase.from('intake_sessions').insert({
      organisation_id: payload.organisationId,
      prospect_id: payload.prospectId,
      token_hash: tokenHash,
      status: 'invited',
      expires_at: expiresAt,
      created_by: payload.actorUserId,
      recipient_email: payload.recipientEmail,
      email_status: 'pending',
    }).select('id').single();
    if (sessionError) throw sessionError;

    const intakeUrl = `${String(payload.publicBaseUrl).replace(/\/$/, '')}/intake/${rawToken}`;
    const email = renderStep2Invitation({
      recipientName: payload.recipientName!,
      companyName: payload.companyName!,
      projectType: payload.projectType!,
      intakeUrl,
      expiresAt,
    });
    const delivery = await sendWithResend({
      recipientEmail: payload.recipientEmail!,
      recipientName: payload.recipientName!,
      email,
    });

    const attemptedAt = new Date().toISOString();
    const sentAt = delivery.status === 'sent' ? attemptedAt : null;
    await supabase.from('intake_sessions').update({
      email_status: delivery.status,
      email_message_id: delivery.messageId,
      email_error: delivery.error,
      last_email_attempt_at: attemptedAt,
      sent_at: sentAt,
    }).eq('id', session.id).throwOnError();

    await supabase.from('prospects').update({
      next_action: delivery.status === 'sent'
        ? 'Await Step 2 technical intake submission'
        : 'Review and resend Step 2 technical intake invitation',
    }).eq('id', payload.prospectId).throwOnError();

    await supabase.from('activity_events').insert({
      organisation_id: payload.organisationId,
      user_id: payload.actorUserId,
      entity_type: 'prospect',
      entity_id: payload.prospectId,
      event_type: delivery.status === 'sent' ? 'step_2_invitation_sent' : 'step_2_invitation_delivery_failed',
      event_data: {
        intakeSessionId: session.id,
        recipient: payload.recipientEmail,
        provider: 'resend',
        emailStatus: delivery.status,
        messageId: delivery.messageId,
        error: delivery.error,
        expiresAt,
      },
    }).throwOnError();

    return json({ success: true, reused: false, sessionId: session.id, emailStatus: delivery.status, expiresAt });
  } catch (error) {
    console.error('send-step-2-invitation failed', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unexpected orchestration error.' }, 500);
  }
});
